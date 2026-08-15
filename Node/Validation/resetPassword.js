const Validator = require("validator");
const isEmpty = require("./isEmpty");
const { t } = require("../Utils/i18n");
// this will be sent to register route in routes/users.js
module.exports = function validateResetInput(data, lang) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.Password = !isEmpty(data.Password) ? data.Password : "";
  data.Password2 = !isEmpty(data.Password2) ? data.Password2 : "";

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
