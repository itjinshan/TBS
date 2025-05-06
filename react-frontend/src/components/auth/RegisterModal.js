import React, { Component } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { registerUser } from "../../actions/authAction";
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
import "./LoginModal.css"; // Reusing the same CSS

class RegisterModal extends Component {
  constructor(props) {
    super(props);
    this.state = {
      FirstName: "",
      LastName: "",
      Phone: "",
      Email: "",
      Password: "",
      Password2: "",
      errors: {}
    };
    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  componentDidUpdate(prevProps) {
    if (this.props.errors !== prevProps.errors) {
      this.setState({ errors: this.props.errors });
    }
    
    // Redirect on successful registration
    if (!prevProps.auth.isAuthenticated && this.props.auth.isAuthenticated) {
      this.handleClose();
      this.props.navigate("/");
    }
  }

  handleClose = () => {
    this.props.onClose();
    this.setState({
      FirstName: "",
      LastName: "",
      Phone: "",
      Email: "",
      Password: "",
      Password2: "",
      errors: {}
    });
  };

  onChange(e) {
    this.setState({ [e.target.name]: e.target.value });
  }
  
  onSubmit(e) {
    e.preventDefault();
    const newUser = {
      FirstName: this.state.FirstName,
      LastName: this.state.LastName,
      Phone: this.state.Phone,
      Email: this.state.Email,
      Password: this.state.Password,
      Password2: this.state.Password2
    };
    this.props.registerUser(newUser, this.props.navigate);
  }

  render() {
    const { open } = this.props;
    const { errors } = this.state;

    return (
      <Dialog
        open={open}
        onClose={this.handleClose}
        maxWidth="sm" // Slightly wider for registration form
        fullWidth
        className="login-modal"
        PaperProps={{ style: { borderRadius: 16 } }}
      >
        {/* Header */}
        <div className="modal-header">
          <IconButton className="close-btn" onClick={this.handleClose}>
            <CloseIcon />
          </IconButton>
          
          <img src={TBSLogo} alt="Logo" className="modal-logo" />
          <Typography className="modal-title">Create Account</Typography>
        </div>

        <DialogContent className="modal-content">
          <form onSubmit={this.onSubmit} className="register-form">
            <div className="form-columns">
              <div className="form-column">
                <TextFieldGroup
                  placeholder="First Name"
                  name="FirstName"
                  value={this.state.FirstName}
                  onChange={this.onChange}
                  error={errors.FirstName}
                />
                
                <TextFieldGroup
                  placeholder="Last Name"
                  name="LastName"
                  value={this.state.LastName}
                  onChange={this.onChange}
                  error={errors.LastName}
                />
                
                <TextFieldGroup
                  placeholder="Phone Number"
                  name="Phone"
                  type="tel"
                  value={this.state.Phone}
                  onChange={this.onChange}
                  error={errors.Phone}
                />
              </div>
              
              <div className="form-column">
                <TextFieldGroup
                  placeholder="Email Address"
                  name="Email"
                  type="email"
                  value={this.state.Email}
                  onChange={this.onChange}
                  error={errors.Email}
                />
                
                <TextFieldGroup
                  placeholder="Password"
                  name="Password"
                  type="password"
                  value={this.state.Password}
                  onChange={this.onChange}
                  error={errors.Password}
                />
                
                <TextFieldGroup
                  placeholder="Confirm Password"
                  name="Password2"
                  type="password"
                  value={this.state.Password2}
                  onChange={this.onChange}
                  error={errors.Password2}
                />
              </div>
            </div>
            
            <Button
              fullWidth
              variant="contained"
              type="submit"
              className="submit-btn"
              size="large"
            >
              Register
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
                  this.props.returnToLoginClick();
                }}
              >
                Back to Login
              </a>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
}

RegisterModal.propTypes = {
  registerUser: PropTypes.func.isRequired,
  auth: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onLoginClick: PropTypes.func.isRequired,
  navigate: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
  auth: state.auth,
  errors: state.errors
});

export default connect(
  mapStateToProps,
  { registerUser }
)(RegisterModal);