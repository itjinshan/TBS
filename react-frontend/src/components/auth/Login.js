import React, { Component } from 'react';
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
import TextFieldGroup from "../../utils/TextFieldGroup";
import Paper from "@mui/material/Paper";
import TBSLogo from "../../images/tbs_logo.jpg";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { loginUser } from "../../actions/authAction";
import withRouter from "../../utils/withRouter";
import "./Auth.css";

class Login extends Component {
    constructor() {
        super();
        this.state = {
          Email: "",
          Password: "",
          errors: {}
        };
        this.onChange = this.onChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    componentDidMount = () => {
        // during logged in , if we change url to login it will redirect to homepage
        if (this.props.auth.isAuthenticated) {
          this.props.navigate("/");
        }
        window.scrollTo(0, 0);
    };

    componentWillReceiveProps = nextProps => {
        if (nextProps.auth.isAuthenticated) {
          this.props.navigate("/");
        }
        if (nextProps.errors) {
          this.setState({ errors: nextProps.errors });
        }
    };

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
        const { errors } = this.state;
        let paperSize;
    
        if (Object.keys(errors).length === 0) {
          paperSize = "AuthPaperLogin";
        } else {
          paperSize = "AuthPaperLoginError";
        }

        return (
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
                  Log In
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
                      <button className="btn btn-info btn-block mt-4" type="submit">Log In</button>
                      {/* <input type="submit" className="btn btn-info btn-block mt-4" style={{fontWeight:600}} /> */}
                    </form>
                  </Grid>
                  <br />
                  <Link to="/forget-password" className="linkToOhter">
                    forgot password?
                  </Link>
                  <Link to="/register" className="linkToOhter">
                    don't have an account?
                  </Link>
                </Grid>
              </Paper>
            </Grid>
          )
    }
}

Login.propTypes = {
    loginUser: PropTypes.func.isRequired,
    auth: PropTypes.object.isRequired
  };
  
const mapStateToProps = state => ({
    auth: state.auth
});
  
export default connect(
    mapStateToProps,
    { loginUser }
)(withRouter(Login));
