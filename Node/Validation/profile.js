const Validator = require("validator");
const isEmpty = require("./isEmpty");
const { t } = require("../Utils/i18n");

module.exports = function validateProfileInput(data, lang) {
  let errors = {};

  data.FirstName = !isEmpty(data.FirstName) ? data.FirstName : "";
  data.LastName = !isEmpty(data.LastName) ? data.LastName : "";

  if (Validator.isEmpty(data.FirstName)) {
    errors.FirstName = t(lang, "firstNameRequired");
  }
  if (Validator.isEmpty(data.LastName)) {
    errors.LastName = t(lang, "lastNameRequired");
  }

  return {
    errors,
    isValid: isEmpty(errors)
  };
};
