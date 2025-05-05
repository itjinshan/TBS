import React, { Component } from 'react';
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
import TextFieldGroup from "../../utils/TextFieldGroup";
import Paper from "@mui/material/Paper";
import TBSLogo from "../../images/tbs_logo.png";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { forgotPassword, resetForgetStatus } from "../../actions/authAction";
import withRouter from "../../utils/withRouter";
import "./Auth.css";

class ForgotPassword extends Component {
    constructor() {
        super();
        this.state = {
          Email: "",
          timer: null,
          forgetStatus: false,
          errors: {}
        };
        this.onChange = this.onChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    componentDidMount = () => {
        window.scrollTo(0, 0);
    };

    componentWillReceiveProps = nextProps => {
      if (nextProps.errors) 
        this.setState({ errors: nextProps.errors });
      if(nextProps.auth.forgetStatus){
        this.setState({timer: setTimeout(() => this.props.resetForgetStatus(), 3000)})
        this.setState({bounceTimer: setTimeout(() => this.bouncePage(), 4000)})
      }
    };

    onChange(e) {
        this.setState({ [e.target.name]: e.target.value });
    }

    bouncePage(){
        this.props.navigate("/");
    }
    
    onSubmit(e) {
        e.preventDefault();
    
        const userEmail = {
          Email: this.state.Email
        };
        this.props.forgotPassword(userEmail);
    }

    render() {
        const { errors } = this.state;
        let paperSize;
        if (Object.keys(errors).length === 0) {
          paperSize = "AuthPaperLogin";
        } else {
          paperSize = "AuthPaperLoginError";
        }

        return (
            <div className="MarginTop MarginBottom">
            { this.props.auth.isUpdated === true 
                ? this.props.auth.forgetStatus
                  ?
                    <div className="notification notification--visible notification--success"> 
                        {this.props.auth.forgetStatusMSG}
                    </div>
                  :
                  <div className="notification notification--visible notification--error"> 
                      {this.props.auth.forgetStatusMSG}
                  </div>
                :
                <div className="notification notification--invisible"/>
            }
            <Grid
              container
              className="AuthContainerLogin"
              spacing={0}
              direction="column"
              justifyContent="center"
              alignItems="center"
              style={{minHeight:window.innerHeight-180}}
            >
              <Paper className={paperSize}>
                <Grid className="AuthTitle">
                  Forgot Password
                </Grid>
                <br />
                <Grid
                  container
                  spacing={0}
                  direction="column"
                  justifyContent="center"
                  alignItems="center"
                >
                  <img className="loginLogo" src={TBSLogo} alt="" />
      
                  <br />
                  <Grid className="AuthTextFields">
                    <form onSubmit={this.onSubmit}>
                      <TextFieldGroup
                        placeholder="Email Address"
                        name="Email"
                        type="Email"
                        value={this.state.Email}
                        onChange={this.onChange}
                        error={errors.Email}
                      />
                      <button className="btn btn-info btn-block mt-4" type="submit">Send Reset Link</button>
                      {/* <input type="submit" className="btn btn-info btn-block mt-4" style={{fontWeight:600}} /> */}
                    </form>
                  </Grid>
                  <br />
                  <Link to="/register" className="linkToOhter">
                    don't have an account?
                  </Link>
                </Grid>
              </Paper>
            </Grid>
            </div>
          )
    }
}

ForgotPassword.propTypes = {
    auth: PropTypes.object.isRequired,
    errors: PropTypes.object.isRequired
};
  
const mapStateToProps = state => ({
    auth: state.auth,
    errors: state.errors
});
  
export default connect(
    mapStateToProps,
    { forgotPassword, resetForgetStatus }
)(withRouter(ForgotPassword));
