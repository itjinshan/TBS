import React, { Component } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { loginUser } from "../../actions/authAction";
import ForgotPasswordModal from './ForgotPasswordModal';
import RegisterModal from './RegisterModal';
import TextFieldGroup from "../../utils/TextFieldGroup";
import { 
  Dialog,
  DialogContent,
  IconButton,
  Button,
  Divider,
  Typography
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import GoogleIcon from '@mui/icons-material/Google';
import WechatIcon from '../../utils/WechatIcon';
import TBSLogo from "../../images/tbs_logo.png";
import "./LoginModal.css";


class LoginModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      Email: "",
      Password: "",
      errors: {},
      forgotPasswordOpen: false,
      registerOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.toggleForgotPassword = this.toggleForgotPassword.bind(this);
    this.toggleRegister = this.toggleRegister.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.auth.isAuthenticated && this.props.auth.isAuthenticated) {
      this.props.onClose();
      this.setState({
        forgotPasswordOpen: false,
        registerOpen: false,
        errors: {}
      });
    }
    if (this.props.errors !== prevProps.errors) {
      this.setState({ errors: this.props.errors });
    }
  }

  toggleForgotPassword() {
    this.setState(prevState => ({
      showForgotPassword: !prevState.showForgotPassword
    }));
  }


  toggleRegister() {
    this.setState(prevState => ({
      showRegisterOpen: !prevState.showRegisterOpen
    }));
  }

  onChange(e) {
    this.setState({ [e.target.name]: e.target.value });
  }
  
  onSubmit(e) {
    e.preventDefault();
    const userData = {
      Email: this.state.Email,
      Password: this.state.Password
    };
    this.props.loginUser(userData);
  }

  render() {
    const { open, onClose } = this.props;
    const { errors, showForgotPassword, showRegisterOpen } = this.state;

    return (
      <>
      <Dialog
        open={open && !showForgotPassword && !showRegisterOpen} 
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        className="login-modal"
      >
        <div className="modal-header">
          <IconButton className="close-btn" onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <img src={TBSLogo} alt="Logo" className="modal-logo" />
          <Typography variant="h5" className="modal-title">Welcome Back</Typography>
        </div>

        <DialogContent className="modal-content">
          <form onSubmit={this.onSubmit} className="login-form">
            <TextFieldGroup
              placeholder="Email Address"
              name="Email"
              type="email"
              value={this.state.Email}
              onChange={this.onChange}
              error={errors.Email}
              className="form-input"
            />
            <TextFieldGroup
              placeholder="Password"
              name="Password"
              type="password"
              value={this.state.Password}
              onChange={this.onChange}
              error={errors.Password}
              className="form-input"
            />
            <Button 
              fullWidth 
              variant="contained" 
              type="submit"
              className="submit-btn"
            >
              Log In
            </Button>
          </form>

          <Divider className="login-modal-divider">OR</Divider>

          <div className="social-logins">
            <Button 
              fullWidth 
              variant="outlined" 
              className="social-btn google"
              startIcon={<GoogleIcon />}
            >
              Continue with Google
            </Button>
            <Button 
              fullWidth 
              variant="outlined" 
              className="social-btn wechat"
              startIcon={<WechatIcon />}
            >
              Continue with WeChat
            </Button>
          </div>

          <div className="other-footer-links">
            <a 
              href="#" 
              className="link" 
              onClick={(e) => {
                e.preventDefault();
                this.toggleForgotPassword();
              }}
            >
              Forgot password?
            </a>
            <a 
              href="#" 
              className="link" 
              onClick={(e) => {
                e.preventDefault();
                this.toggleRegister();
              }}
            >
              Don't have an account? Sign up
            </a>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Modal */}
       <ForgotPasswordModal
          open={showForgotPassword}
          onClose={() => {
            this.toggleForgotPassword();
            onClose();
          }}
          returnToLoginClick={() => {
            this.toggleForgotPassword();
            this.setState({ errors: {} });
            // If you need to reopen login modal:
            if (!open) onClose(); 
          }}
          registrationClick={() => {
            this.toggleRegister();
            if(!open) onClose();
          }}
        />
        {/* Register Modal */}
        <RegisterModal
          open={showRegisterOpen}
          onClose={() => {
            this.toggleRegister();
            onClose();
          }}
          returnToLoginClick={() => {
            this.toggleRegister();
            // If you need to reopen login modal:
            if (!open) onClose(); 
          }}
          navigate={this.props.navigate}
        />
      </>
    );
  }
}

LoginModal.propTypes = {
  loginUser: PropTypes.func.isRequired,
  auth: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  auth: state.auth,
  errors: state.errors
});

export default connect(
  mapStateToProps,
  { loginUser }
)(LoginModal);