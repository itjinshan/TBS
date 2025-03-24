import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux"; // use this to connect react component to redux
import { registerUser } from "../../actions/authAction";
import TextFieldGroup from "../../utils/TextFieldGroup";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid2";
import TBSLogo from "../../images/tbs_logo.jpg";
import { Link } from "react-router-dom";
import withRouter from "../../utils/withRouter";
import "./Auth.css";

class Register extends Component {
  constructor() {
    super();
    this.state = {
      FirstName: "",
      LastName: "",
      Phone: "",
      Email: "",
      Password: "",
      Password2: "", //for inputing password again
      errors: {}
    };

    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
  }

  componentDidMount = () => {
    // during logged in , if we change url to register it will redirect to homepage
    if (this.props.auth.isAuthenticated) {
      this.props.navigate("/");
    }
    window.scrollTo(0, 0);
  };

  componentWillReceiveProps = nextProps => {
    if (nextProps.errors) {
      this.setState({ errors: nextProps.errors });
    }
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
    this.props.registerUser(newUser, this.props.navigate); // second para to route to other page
  }

  render() {
    const { errors } = this.state;
    let paperSize;
    if (Object.keys(errors).length === 0) {
      paperSize = "AuthPaperSignUp";
    } else {
      paperSize = "AuthPaperSignUpError";
    }
    return (
      <Grid
        container
        className="AuthContainerSignUp"
        spacing={0}
        direction="column"
        justifyContent="center"
        alignItems="center"
      >
        <Paper className={paperSize}>
          <Grid className="AuthTitle">
            Sign Up
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
              <form noValidate onSubmit={this.onSubmit}>
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
                  type="Phone"
                  value={this.state.Phone}
                  onChange={this.onChange}
                  error={errors.Phone}
                />

                <TextFieldGroup
                  placeholder="Email Address"
                  name="Email"
                  type="Email"
                  value={this.state.Email}
                  onChange={this.onChange}
                  error={errors.Email}
                />

                <TextFieldGroup
                  placeholder="Password"
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
                <button className="btn btn-info btn-block mt-4" type="submit">Register</button>

                {/* <input type="submit" className="btn btn-info btn-block mt-4" /> */}
              </form>
            </Grid>
            <br />
            <Link to="/login" className="linkToOhter">
              already have an account?
            </Link>
          </Grid>
        </Paper>
      </Grid>
    );
  }
}

// map props to PropTypes for type checking
Register.propTypes = {
  registerUser: PropTypes.func.isRequired,
  auth: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
  auth: state.auth,
  errors: state.errors
});

export default connect(
  mapStateToProps,
  { registerUser }
)(withRouter(Register)); // withRouter to route to other page