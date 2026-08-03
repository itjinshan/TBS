var express = require('express');
var router = express.Router();
var rateLimit = require('express-rate-limit');
var validateLoginInput = require("../Validation/login");
var validateRegisterInput = require("../Validation/register");
var validateResetInput = require("../Validation/resetPassword");
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const passport = require("passport");
require("../Config/passport")(passport);

var User = require('../DB_Models/DB_User');

// Function to generate JWT Access Token  
var generateAccessToken = require('../Config/jwtgenerator');

// Welcome email
var welcomeEmail = require('../Emails/welcomeEmail');
const forgotPasswordEmail = require('../Emails/forgotPasswordEmail');
const createPasswordEmail = require('../Emails/createPasswordEmail');

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

// IP-based rate limiting on login, on top of the per-account lockout below.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { Email: "Too many login attempts from this network. Please try again later." }
});

// Register
router.post('/register', (req, res) => {
    // user fills out the form do a POST req here
    const { errors, isValid } = validateRegisterInput(req.body);
    // ** Validation **
    //
    if (!isValid) {
      return res.status(400).json(errors);
    }

    // Verfication of existing users
    User.findOne({
    "$or":[
        {
        // find out if the email already exists
        Email: req.body.Email
        },
        {
        // find out if the phone already exists
        Phone: req.body.Phone
        }
    ]

    }).then(user => {
    // user is the object returned by findOne()
    if (user) {
        if(user.Email === req.body.Email ) errors.Email = "Email already exists";
        if(user.Phone !== "xxx" && user.Phone === req.body.Phone) errors.Phone = "Phone number already exists";
        return res.status(400).json(errors);
    } else {
        // ** Create New User **
        //
        var newUser = new User({
          // create new user if cannot find the email nor phone number
          FirstName: req.body.FirstName,
          LastName: req.body.LastName,
          Phone: req.body.Phone,
          Email: req.body.Email,
          Password: req.body.Password
        });
        bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(newUser.Password, salt, (err, hash) => {
            if (err) {
              console.log("Auth API/Register: error occurred while hashing password. " + err);
              throw err;
            } 
            newUser.Password = hash; // hash the password from the user and store it back
            newUser
            .save() // use mongoose model to save to mongodb mlab
            .then(user => {
                  // ** Auto Login **
                  //
                  AccessToken = generateAccessToken(user, 'auth');
                  RefreshToken = generateAccessToken(user, 'refresh');
                  return res.json({
                    Email: user.Email,
                    AccessToken: "Bearer " + AccessToken,
                    RefreshToken: RefreshToken
                  });
            })
            .catch(err => console.log(err));
        });
        });

        // ** Logistics **
        //
        // Send Welcome Emails
        // welcomeEmail(req.body.FirstName, req.body.LastName, Email);
    }
    });
});

// Login
router.post('/login', loginLimiter, (req, res) => {
    const { errors, isValid } = validateLoginInput(req.body);

    //check validation
    if (!isValid) {
      return res.status(400).json(errors);
    }

    const Email = req.body.Email;
    const Password = req.body.Password;

    User.findOne({
      Email
    }).then(user => {
      if (!user) {
        // if user not found
        errors.Email = "User not found";
        return res.status(404).json(errors);
      }

      // Per-account lockout after repeated failed attempts
      if (user.LockUntil && user.LockUntil > Date.now()) {
        const minutesLeft = Math.ceil((user.LockUntil - Date.now()) / 60000);
        errors.Email = `Too many failed attempts. Please try again in ${minutesLeft} minute(s).`;
        return res.status(423).json(errors);
      }

       // if user found in the data base then check the password
       bcrypt.compare(Password, user.Password).then(isMatch => {
        if (isMatch) {
          // Reset lockout tracking on a successful login
          user.FailedLoginAttempts = 0;
          user.LockUntil = undefined;
          user.save().then(() => {
            //Sign Token as a sign of success validation
            AccessToken = generateAccessToken(user, 'auth');
            RefreshToken = generateAccessToken(user, 'refresh');
            res.json({
              Email: user.Email,
              AccessToken: "Bearer " + AccessToken,
              RefreshToken: RefreshToken
            });
          });

        } else {
          user.FailedLoginAttempts = (user.FailedLoginAttempts || 0) + 1;
          if (user.FailedLoginAttempts >= LOGIN_MAX_ATTEMPTS) {
            user.LockUntil = Date.now() + LOGIN_LOCK_MS;
            user.FailedLoginAttempts = 0;
          }
          // Awaited so the lock is committed before the response goes out —
          // otherwise rapid consecutive attempts could race past the lockout.
          user.save().then(() => {
            errors.Password = "Password incorrect";
            return res.status(400).json(errors);
          });
        }
      });
    });
  });



// Get Current User
router.get("/current", passport.authenticate("jwt", {
    session: false
}), // not using session
    (req, res) => {
      AccessToken = generateAccessToken(req.user, 'auth');
      RefreshToken = generateAccessToken(req.user, 'refresh');
      res.json({
        UserID: req.user._id,
        Email: req.user.Email,
        FirstName: req.user.FirstName,
        LastName: req.user.LastName,
        Phone: req.user.Phone,
        AccessToken: "Bearer " + AccessToken,
        RefreshToken: RefreshToken
      })
    }
);

// Forgot Password
router.put("/forgot-password", (req, res) => {
  const Email = req.body.Email;
  const errors = {};
  User.findOne({ Email })
      .then(user => {
        if(!user){
          errors.Email = "Email not found."
          return res.status(404).json(errors);
        }
        let resetToken = jwt.sign({ UserID: user._id }, process.env.resetSecret, { expiresIn: 1200 });
        user.updateOne({ ResetToken: resetToken }, (err, success) => {
          if(err){
              res.json({
                  statusmsg:"An error has occurred while sending the password reset link, please try again.",
                  forgetStatus: false
              });
            } else {
              res.json({
                  statusmsg:"A password reset link was successfully sent to your email, please follow the link to reset your password.",
                  forgetStatus: true
              });
            }
        });
        // forgotPasswordEmail(Email, resetToken);
      })
})

// Reset Password
router.put("/reset-password", (req,res) => {
    // user fills out the form do a POST req here
    const { errors, isValid } = validateResetInput(req.body);
    //check validation
    if (!isValid) {
      return res.status(400).json(errors);
    }
  const resetToken = req.body.ResetToken;
  let newPassword = req.body.Password;
  if(resetToken){
    jwt.verify(resetToken, process.env.RESETSECRET, (err, decoded) => {
      if(err){
        return res.json({
          statusmsg:"Reset link has expired. Please request a new link.",
          resetStatus: false
        })
      }
      const UserID = decoded.UserID;
      User.findById({ _id: UserID })
          .then( user => {
            if(!user){
              return res.json({
                statusmsg:"Error has occurred while resetting new password. Try again later.",
                resetStatus: false
              })
            }
            bcrypt.genSalt(10, (err, salt) => {
              bcrypt.hash(newPassword, salt, (err, hash) => {
                  if (err) throw err;
                  newPassword = hash;
                  user.update({ Password: newPassword, ResetToken: '' }, (err, success) => {
                    if(err){
                      return res.json({
                        statusmsg:"Error has occurred while updating new password to Database. Try again later.",
                        resetStatus: false
                      })
                    }
                    return res.json({
                      statusmsg:"Password has been updated successfully.",
                      resetStatus: true
                    })
                  })      
              });
            });
          })
    })
  }else{
    return res.status(400).json(errors);
  }
})

router.put("/create-password", (req,res) => {
  // user fills out the form do a POST req here
  const { errors, isValid } = validateResetInput(req.body);
  //check validation
  if (!isValid) {
    return res.status(400).json(errors);
  }
  const resetToken = req.body.ResetToken;
  let newPassword = req.body.Password;
  if(resetToken){
    jwt.verify(resetToken, process.env.resetSecret, (err, decoded) => {
      if(err){
        return res.json({
          statusmsg:"Link has expired. Please request a new link.",
          createStatus: false
        })
      }
      const UserID = decoded.UserID;
      User.findById({ _id: UserID })
          .then( user => {
            if(!user){
              return res.json({
                statusmsg:"Error has occurred while creating new password. Try again later.",
                createStatus: false
              })
            }
            bcrypt.genSalt(10, (err, salt) => {
              bcrypt.hash(newPassword, salt, (err, hash) => {
                  if (err) throw err;
                  newPassword = hash; 
                  user.update({ Password: newPassword, ResetToken: '' }, (err, success) => {
                    if(err){
                      return res.json({
                        statusmsg:"Error has occurred while updating new password to Database. Try again later.",
                        createStatus: false
                      })
                    }
                    return res.json({
                      statusmsg:"Password has been updated successfully.",
                      createStatus: true
                    })
                  })      
              });
            });
          })
    })
  }else{
    return res.status(400).json(errors);
  }
})

module.exports = router;