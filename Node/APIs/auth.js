var express = require('express');
var router = express.Router();
var rateLimit = require('express-rate-limit');
var validateLoginInput = require("../Validation/login");
var validateRegisterInput = require("../Validation/register");
var validateResetInput = require("../Validation/resetPassword");
var validateProfileInput = require("../Validation/profile");
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
const passport = require("passport");
require("../Config/passport")(passport);

var User = require('../DB_Models/DB_User');
var { t } = require('../Utils/i18n');

// Function to generate JWT Access Token
var generateAccessToken = require('../Config/jwtgenerator');

// Welcome email
var welcomeEmail = require('../Emails/welcomeEmail');
var verifyEmail = require('../Emails/verifyEmail');
const forgotPasswordEmail = require('../Emails/forgotPasswordEmail');
const createPasswordEmail = require('../Emails/createPasswordEmail');

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000; // 15 minutes

// IP-based rate limiting on login, on top of the per-account lockout below.
// `message` as a function (not a static value) so it can read req.lang,
// same as every other response in this file.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: (req) => ({ Email: t(req.lang, "tooManyLoginAttempts") })
});

// Register
router.post('/register', (req, res) => {
    // user fills out the form do a POST req here
    const { errors, isValid } = validateRegisterInput(req.body, req.lang);
    // ** Validation **
    //
    if (!isValid) {
      return res.status(400).json(errors);
    }

    // Verfication of existing users
    User.findOne({ Email: req.body.Email }).then(user => {
    // user is the object returned by findOne()
    if (user) {
        errors.Email = t(req.lang, "emailAlreadyExists");
        return res.status(400).json(errors);
    } else {
        // ** Create New User **
        //
        var newUser = new User({
          // create new user if cannot find the email
          FirstName: req.body.FirstName,
          LastName: req.body.LastName,
          Phone: req.body.Phone,
          Email: req.body.Email,
          Password: req.body.Password,
          IsVerified: false
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
                  // ** Require email verification before login **
                  // (welcomeEmail is sent once the user verifies, see PUT /verify-email)
                  const verificationToken = generateAccessToken(user, 'emailVerify');
                  verifyEmail(user.FirstName, user.Email, verificationToken);
                  return res.json({
                    Email: user.Email,
                    pendingVerification: true,
                    message: t(req.lang, "registrationSuccess")
                  });
            })
            .catch(err => console.log(err));
        });
        });
    }
    });
});

// Login
router.post('/login', loginLimiter, (req, res) => {
    const { errors, isValid } = validateLoginInput(req.body, req.lang);

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
        errors.Email = t(req.lang, "userNotFound");
        return res.status(404).json(errors);
      }

      // Per-account lockout after repeated failed attempts
      if (user.LockUntil && user.LockUntil > Date.now()) {
        const minutesLeft = Math.ceil((user.LockUntil - Date.now()) / 60000);
        errors.Email = t(req.lang, "tooManyFailedAttempts", minutesLeft);
        return res.status(423).json(errors);
      }

       // if user found in the data base then check the password
       bcrypt.compare(Password, user.Password).then(isMatch => {
        if (isMatch) {
          if (!user.IsVerified) {
            errors.Email = t(req.lang, "pleaseVerifyEmail");
            return res.status(403).json(errors);
          }

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
            errors.Password = t(req.lang, "passwordIncorrect");
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

// Update the logged-in user's profile info — see CLAUDE.md's "Pending
// Tasks", "Build a profile management page". Only FirstName/LastName/Phone
// are editable here; Email/Password have their own dedicated flows.
router.put("/profile", passport.authenticate("jwt", { session: false }), (req, res) => {
  const { errors, isValid } = validateProfileInput(req.body, req.lang);
  if (!isValid) {
    return res.status(400).json(errors);
  }

  req.user.FirstName = req.body.FirstName;
  req.user.LastName = req.body.LastName;
  req.user.Phone = req.body.Phone;

  req.user.save()
    .then(user => {
      res.json({
        UserID: user._id,
        Email: user.Email,
        FirstName: user.FirstName,
        LastName: user.LastName,
        Phone: user.Phone
      });
    })
    .catch(err => {
      console.log(err);
      res.status(400).json({ message: t(req.lang, "failedToUpdateProfile") });
    });
});

// Verify Email
router.put("/verify-email", (req, res) => {
  const VerificationToken = req.body.VerificationToken;
  if (!VerificationToken) {
    return res.status(400).json({ verifyStatus: false, code: "missing_token", statusmsg: t(req.lang, "missingVerificationToken") });
  }
  jwt.verify(VerificationToken, process.env.EMAIL_VERIFY_SECRET, (err, decoded) => {
    if (err) {
      return res.json({ verifyStatus: false, code: "expired", statusmsg: t(req.lang, "verificationLinkExpired") });
    }
    User.findById(decoded.UserID)
      .then(user => {
        if (!user) {
          return res.json({ verifyStatus: false, code: "not_found", statusmsg: t(req.lang, "accountNotFound") });
        }
        if (user.IsVerified) {
          return res.json({ verifyStatus: true, code: "already_verified", statusmsg: t(req.lang, "emailAlreadyVerified") });
        }
        user.IsVerified = true;
        user.save().then(() => {
          welcomeEmail(user.FirstName, user.LastName, user.Email);
          res.json({ verifyStatus: true, code: "success", statusmsg: t(req.lang, "emailVerifiedSuccess") });
        });
      })
      .catch(err => {
        res.json({ verifyStatus: false, code: "error", statusmsg: t(req.lang, "errorVerifyingEmail") });
      });
  });
});

// Resend Verification Email
router.post("/resend-verification", (req, res) => {
  const Email = req.body.Email;
  const errors = {};
  User.findOne({ Email })
    .then(user => {
      if (!user) {
        errors.Email = t(req.lang, "emailNotFound");
        return res.status(404).json(errors);
      }
      if (user.IsVerified) {
        return res.json({ resendStatus: false, statusmsg: t(req.lang, "accountAlreadyVerified") });
      }
      const verificationToken = generateAccessToken(user, 'emailVerify');
      verifyEmail(user.FirstName, user.Email, verificationToken);
      res.json({ resendStatus: true, statusmsg: t(req.lang, "newVerificationLinkSent") });
    });
});

// Forgot Password
router.put("/forgot-password", (req, res) => {
  const Email = req.body.Email;
  const errors = {};
  User.findOne({ Email })
      .then(user => {
        if(!user){
          errors.Email = t(req.lang, "emailNotFound");
          return res.status(404).json(errors);
        }
        let resetToken = jwt.sign({ UserID: user._id }, process.env.resetSecret, { expiresIn: 1200 });
        user.updateOne({ ResetToken: resetToken }, (err, success) => {
          if(err){
              res.json({
                  statusmsg: t(req.lang, "forgotPasswordSendError"),
                  forgetStatus: false
              });
            } else {
              res.json({
                  statusmsg: t(req.lang, "passwordResetLinkSent"),
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
    const { errors, isValid } = validateResetInput(req.body, req.lang);
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
          statusmsg: t(req.lang, "resetLinkExpired"),
          resetStatus: false
        })
      }
      const UserID = decoded.UserID;
      User.findById({ _id: UserID })
          .then( user => {
            if(!user){
              return res.json({
                statusmsg: t(req.lang, "resetPasswordUserError"),
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
                        statusmsg: t(req.lang, "resetPasswordDbError"),
                        resetStatus: false
                      })
                    }
                    return res.json({
                      statusmsg: t(req.lang, "passwordUpdatedSuccess"),
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
  const { errors, isValid } = validateResetInput(req.body, req.lang);
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
          statusmsg: t(req.lang, "createPasswordLinkExpired"),
          createStatus: false
        })
      }
      const UserID = decoded.UserID;
      User.findById({ _id: UserID })
          .then( user => {
            if(!user){
              return res.json({
                statusmsg: t(req.lang, "createPasswordUserError"),
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
                        statusmsg: t(req.lang, "createPasswordDbError"),
                        createStatus: false
                      })
                    }
                    return res.json({
                      statusmsg: t(req.lang, "passwordUpdatedSuccess"),
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
