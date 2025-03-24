var express = require('express');
var router = express.Router();
var validateLoginInput = require("../Validation/login");
var validateRegisterInput = require("../Validation/register");
var validateResetInput = require("../Validation/resetPassword");
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const passport = require("passport");
require("../Config/passport")(passport);

var User = require('../DB_Models/DB_User');

// Welcome email
var welcomeEmail = require('../Emails/welcomeEmail');
const forgotPasswordEmail = require('../Emails/forgotPasswordEmail');
const createPasswordEmail = require('../Emails/createPasswordEmail');

// Register
router.post('/register', (req, res) => {
    // user fills out the form do a POST req here
    const { errors, isValid } = validateRegisterInput(req.body);
    //check validation
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
            .then(user => res.json(user))
            .catch(err => console.log(err));
        });
        });

        // Send Welcome Emails
        // welcomeEmail(req.body.FirstName, req.body.LastName, req.body.Email);
    }
    });
});

// Login
router.post('/login', (req, res) => {
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
       // if user found in the data base then check the password
       bcrypt.compare(Password, user.Password).then(isMatch => {
        if (isMatch) {
          //Sign Token as a sign of success validation
          AccessToken = generateAccessToken(user)
          RefreshToken = jwt.sign(
            {
              UserID: user.id,
              FirstName: user.FirstName,
              LastName: user.LastName
            },
            process.env.REFRESHSECRETE
          )
          res.json({
            Email: user.Email,
            AccessToken: "Bearer " + AccessToken,
            RefreshToken: RefreshToken
          });
          
        } else {
          errors.Password = "Password incorrect";
          return res.status(400).json(errors);
        }
      });
    });
  });

// Function to generate JWT Access Token
function generateAccessToken(user){
  return jwt.sign(
    {
      UserID: user.id,
      FirstName: user.FirstName,
      LastName: user.LastName
    },
    process.env.ACCESSSECRETE,
    {
      expiresIn: 3600
    }
  );
}

// Get Current User
router.get("/current", passport.authenticate("jwt", {
    session: false
}), // not using session
    (req, res) => {
      AccessToken = generateAccessToken(req.user);
      RefreshToken = jwt.sign(
        {
          UserID: req.user.id,
          FirstName: req.user.FirstName,
          LastName: req.user.LastName
        },
        process.env.REFRESHSECRETE
      )
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