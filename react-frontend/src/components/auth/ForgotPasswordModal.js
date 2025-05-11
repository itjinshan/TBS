import React, { Component } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { forgotPassword, resetForgetStatus } from "../../actions/authAction";
import TextFieldGroup from "../../utils/TextFieldGroup";
import { 
  Dialog,
  DialogContent,
  IconButton,
  Button,
  Typography,
  Snackbar,
  Alert
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import TBSLogo from "../../images/tbs_logo.png";
import RegisterModal from './RegisterModal';
import "./LoginModal.css"; // Reusing the same CSS

class ForgotPasswordModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      Email: "",
      errors: {},
      open: props.open,
      onClose: props.onClose(), // Controlled by parent
      registerOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.toggleRegister = this.toggleRegister.bind(this);
  }

  componentDidUpdate(prevProps) {
    // Handle modal open/close from parent
    if (this.props.open !== prevProps.open) {
      this.setState({ open: this.props.open });
    }
    
    // Handle errors
    if (this.props.errors !== prevProps.errors) {
      this.setState({ errors: this.props.errors });
    }
  }

  handleClose = () => {
    this.props.onClose(); // Call the parent's onClose
    this.setState({ Email: "", errors: {} });
    this.props.resetForgetStatus();
  };

  onChange(e) {
    this.setState({ [e.target.name]: e.target.value });
  }
  
  onSubmit(e) {
    e.preventDefault();
    const userEmail = {
      Email: this.state.Email
    };
    this.props.forgotPassword(userEmail);
  }

  toggleRegister() {
    this.setState(prevState => ({
      showRegisterOpen: !prevState.showRegisterOpen
    }));
  }

  render() {
    const { open, onClose, errors, showRegisterOpen } = this.state;
    const { forgetStatus, forgetStatusMSG } = this.props.auth;

    return (
      <>
        <Dialog
          open={open && !showRegisterOpen}
          onClose={this.handleClose}
          maxWidth="xs"
          fullWidth
          className="login-modal"
          PaperProps={{ style: { borderRadius: 16 } }}
        >
          {/* Header */}
          <div className="modal-header">
            <IconButton 
              className="close-btn" 
              onClick={this.handleClose}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
            
            <img src={TBSLogo} alt="Logo" className="modal-logo" />
            <Typography className="modal-title">Reset Password</Typography>
          </div>

          <DialogContent className="modal-content">
            {/* Success Message (shown in modal) */}
            {forgetStatus && (
              <div className="success-message">
                {forgetStatusMSG}
              </div>
            )}

            {/* Form */}
            <form onSubmit={this.onSubmit} className="login-form">
              <TextFieldGroup
                name="Email"
                type="email"
                placeholder="Email Address"
                value={this.state.Email}
                onChange={this.onChange}
                error={errors.Email}
              />
              
              <Button
                fullWidth
                variant="contained"
                type="submit"
                className="submit-btn"
              >
                Send Reset Link
              </Button>
            </form>

            {/* Footer Links */}
            <div className="other-footer-links">
              <a 
                href="#" 
                className="link" 
                onClick={(e) => {
                  e.preventDefault();
                  this.props.returnToLoginClick();
                }}
              >
                Back to Login
              </a>
            </div>
          </DialogContent>
        </Dialog>

        {/* Error Snackbar */}
        <Snackbar
          open={forgetStatus === false && forgetStatusMSG}
          autoHideDuration={6000}
          onClose={() => this.props.resetForgetStatus()}
        >
          <Alert severity="error">
            {forgetStatusMSG}
          </Alert>
        </Snackbar>
      </>
    );
  }
}

ForgotPasswordModal.propTypes = {
  forgotPassword: PropTypes.func.isRequired,
  resetForgetStatus: PropTypes.func.isRequired,
  auth: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  returnToLoginClick: PropTypes.func.isRequired,
  setRegister: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  auth: state.auth,
  errors: state.errors
});

export default connect(
  mapStateToProps,
  { forgotPassword, resetForgetStatus }
)(ForgotPasswordModal);