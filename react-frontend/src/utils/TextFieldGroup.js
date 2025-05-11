import React from "react";
import classnames from "classnames";
import PropTypes from "prop-types";
import "./TextFieldGroup.css";

// Text input for one line, f.e. street
const TextFieldGroup = ({
  name,
  placeholder,
  value,
  error,
  info,
  type,
  onChange,
  disabled
}) => {
  return (
    <div className="text-field-group">
      <input
        type={type}
        className={classnames("text-field-input", {
          "text-field-error": error
        })}
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {info && <small className="text-field-info">{info}</small>}
      {error && <div className="text-field-error-message">{error}</div>}
    </div>
  );
};

TextFieldGroup.propTypes = {
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  value: PropTypes.string.isRequired,
  error: PropTypes.string,
  info: PropTypes.string,
  type: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.string
};

TextFieldGroup.defaultProps = {
  type: "text"
};

export default TextFieldGroup;