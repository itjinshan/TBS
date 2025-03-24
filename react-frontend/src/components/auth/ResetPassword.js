import React, { Component } from 'react';
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
import TextFieldGroup from "../../utils/TextFieldGroup";
import Paper from "@mui/material/Paper";
import TBSLogo from "../../images/tbs_logo.jpg";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { resetPassword, resetResetStatus } from "../../actions/authAction";
import withRouter from "../../utils/withRouter";
import "./Auth.css";

class ResetPassword extends Component {
    constructor() {
        super();
        this.state = {
          Password: "",
          Password2:"",
          ResetToken:"",
          timer: null,
          resetStatus: false,
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
        if(nextProps.auth.isUpdated){
          this.setState({timer: setTimeout(() => this.props.resetResetStatus(), 3000)})
          // only after resetting successfully, bounce to login page 
          if(nextProps.auth.resetStatus) {
            this.setState({bounceTimer: setTimeout(() => this.bouncePage(), 4000)})
          }
        }
    };

    onChange(e) {
        this.setState({ [e.target.name]: e.target.value });
    }

    bouncePage(){
      this.props.navigate("/login");
    }
    
    onSubmit(e) {
        e.preventDefault();
        
        const newPassword = {
          Password: this.state.Password,
          Password2: this.state.Password2,
          ResetToken: this.props.location.search.split("=")[1]
        };
        this.props.resetPassword(newPassword);
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
                ? this.props.auth.resetStatus === true 
                    ?
                    <div className="notification notification--visible notification--success"> 
                        {this.props.auth.resetStatusMSG}
                    </div>
                    :
                    <div className="notification notification--visible notification--warning"> 
                        {this.props.auth.resetStatusMSG}
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
                    Password Reset
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
                        placeholder="New Password"
                        name="Password"
                        type="Password"
                        value={this.state.Password}
                        onChange={this.onChange}
                        error={errors.Password}
                      />
                      <TextFieldGroup
                        placeholder="Confirm Password"
                        name="Password2"
                        type="Password"
                        value={this.state.Password2}
                        onChange={this.onChange}
                        error={errors.Password2}
                      />
                      <button className="btn btn-info btn-block mt-4" type="submit">Reset Password</button>
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

ResetPassword.propTypes = {
    auth: PropTypes.object.isRequired,
    errors: PropTypes.object.isRequired
};
  
const mapStateToProps = state => ({
    auth: state.auth,
    errors: state.errors
});
  
export default connect(
    mapStateToProps,
    { resetPassword, resetResetStatus }
)(withRouter(ResetPassword));
