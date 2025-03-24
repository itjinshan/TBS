const Validator = require("validator");
const isEmpty = require("./isEmpty");
// this will be sent to register route in routes/users.js
module.exports = function validateResetInput(data) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.Password = !isEmpty(data.Password) ? data.Password : "";
  data.Password2 = !isEmpty(data.Password2) ? data.Password2 : "";

  if (Validator.isEmpty(data.Password)) {
    errors.Password = "Password field is required.";
  }

  if (
    !Validator.isLength(data.Password, {
      min: 6,
      max: 30
    })
  ) {
    errors.Password = "Password must be between 6 and 30 characters.";
  }

  if (Validator.isEmpty(data.Password2)) {
    errors.Password2 = "Confirm Password field is required.";
  }

  if (!Validator.equals(data.Password, data.Password2)) {
    errors.Password = "Passwords must match.";
  }

  // if errors isEmpty() is true -> no valid input
  return {
    errors,
    isValid: isEmpty(errors)
  };
};