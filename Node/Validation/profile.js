const Validator = require("validator");
const isEmpty = require("./isEmpty");

module.exports = function validateProfileInput(data) {
  let errors = {};

  data.FirstName = !isEmpty(data.FirstName) ? data.FirstName : "";
  data.LastName = !isEmpty(data.LastName) ? data.LastName : "";

  if (Validator.isEmpty(data.FirstName)) {
    errors.FirstName = "Please enter your first name.";
  }
  if (Validator.isEmpty(data.LastName)) {
    errors.LastName = "Please enter your last name.";
  }

  return {
    errors,
    isValid: isEmpty(errors)
  };
};
