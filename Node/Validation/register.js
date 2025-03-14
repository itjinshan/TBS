const Validator = require("validator");
const isEmpty = require("./isEmpty");
// this will be sent to register route in routes/users.js
module.exports = function validateRegisterInput(data) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.FirstName = !isEmpty(data.FirstName) ? data.FirstName : "";
  data.LastName = !isEmpty(data.LastName) ? data.LastName : "";
  data.Email = !isEmpty(data.Email) ? data.Email : "";
  data.Password = !isEmpty(data.Password) ? data.Password : "";
  data.Password2 = !isEmpty(data.Password2) ? data.Password2 : "";

  if (Validator.isEmpty(data.FirstName)) {
    errors.FirstName = "Please enter your first name.";
  }
  if (Validator.isEmpty(data.LastName)) {
    errors.LastName = "Please enter your last name.";
  }

  if (Validator.isEmpty(data.Phone)){
    errors.Phone = "Phone number field is required.";
  }

  if (Validator.isEmpty(data.Email)) {
    errors.Email = "Email field is required.";
  }

  if (!Validator.isEmail(data.Email)) {
    errors.Email = "Email field is invalid.";
  }

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