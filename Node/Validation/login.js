const Validator = require("validator");
const isEmpty = require("./isEmpty");
// this will be sent to register route in routes/users.js
module.exports = function validateLoginInput(data) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.Email = !isEmpty(data.Email) ? data.Email : "";
  data.Password = !isEmpty(data.Password) ? data.Password : "";

  if (!Validator.isEmail(data.Email)) {
    errors.Email = "Email field is invalid";
  }

  if (Validator.isEmpty(data.Password)) {
    errors.Password = "Password field is required";
  }

  if (Validator.isEmpty(data.Email)) {
    errors.Email = "Email field is required";
  }

  // if errors isEmpty() is true -> no valid input
  return {
    errors,
    isValid: isEmpty(errors)
  };
};