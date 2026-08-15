const Validator = require("validator");
const isEmpty = require("./isEmpty");
const { t } = require("../Utils/i18n");
// this will be sent to register route in routes/users.js
module.exports = function validateRegisterInput(data, lang) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.FirstName = !isEmpty(data.FirstName) ? data.FirstName : "";
  data.LastName = !isEmpty(data.LastName) ? data.LastName : "";
  data.Email = !isEmpty(data.Email) ? data.Email : "";
  data.Password = !isEmpty(data.Password) ? data.Password : "";
  data.Password2 = !isEmpty(data.Password2) ? data.Password2 : "";

  if (Validator.isEmpty(data.FirstName)) {
    errors.FirstName = t(lang, "firstNameRequired");
  }
  if (Validator.isEmpty(data.LastName)) {
    errors.LastName = t(lang, "lastNameRequired");
  }

  if (Validator.isEmpty(data.Email)) {
    errors.Email = t(lang, "emailRequired");
  }

  if (!Validator.isEmail(data.Email)) {
    errors.Email = t(lang, "emailInvalid");
  }

  if (Validator.isEmpty(data.Password)) {
    errors.Password = t(lang, "passwordRequired");
  }

  if (
    !Validator.isLength(data.Password, {
      min: 6,
      max: 30
    })
  ) {
    errors.Password = t(lang, "passwordLength");
  }

  if (Validator.isEmpty(data.Password2)) {
    errors.Password2 = t(lang, "confirmPasswordRequired");
  }

  if (!Validator.equals(data.Password, data.Password2)) {
    errors.Password = t(lang, "passwordsMustMatch");
  }

  // if errors isEmpty() is true -> no valid input
  return {
    errors,
    isValid: isEmpty(errors)
  };
};
