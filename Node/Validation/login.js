const Validator = require("validator");
const isEmpty = require("./isEmpty");
const { t } = require("../Utils/i18n");
// this will be sent to register route in routes/users.js
module.exports = function validateLoginInput(data, lang) {
  let errors = {};

  // if it is empty change it to empty string so Validator can work
  data.Email = !isEmpty(data.Email) ? data.Email : "";
  data.Password = !isEmpty(data.Password) ? data.Password : "";

  if (!Validator.isEmail(data.Email)) {
    errors.Email = t(lang, "emailInvalid");
  }

  if (Validator.isEmpty(data.Password)) {
    errors.Password = t(lang, "passwordRequired");
  }

  if (Validator.isEmpty(data.Email)) {
    errors.Email = t(lang, "emailRequired");
  }

  // if errors isEmpty() is true -> no valid input
  return {
    errors,
    isValid: isEmpty(errors)
  };
};
