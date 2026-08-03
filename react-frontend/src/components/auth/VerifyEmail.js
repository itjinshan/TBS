import React, { Component } from 'react';
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
import Paper from "@mui/material/Paper";
import TBSLogo from "../../images/tbs_logo.png";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { verifyEmailToken } from "../../actions/authAction";
import "./Auth.css";

class VerifyEmail extends Component {
    componentDidMount() {
        window.scrollTo(0, 0);
        const VerificationToken = window.location.search.split("=")[1];
        this.props.verifyEmailToken(VerificationToken);
    }

    render() {
        const { verifyStatus, verifyStatusMSG } = this.props.auth;

        return (
            <div className="MarginTop MarginBottom">
            <Grid
              container
              className="AuthContainerLogin"
              spacing={0}
              direction="column"
              justifyContent="center"
              alignItems="center"
              style={{minHeight:window.innerHeight-180}}
            >
              <Paper className="AuthPaperLogin">
                <Grid className="AuthTitle">
                    Email Verification
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
                  { verifyStatus === null
                      ? <p>Verifying your email...</p>
                      : <div className={`notification notification--visible notification--${verifyStatus ? "success" : "warning"}`}>
                          {verifyStatusMSG}
                        </div>
                  }
                  <br />
                  <Link to="/" className="linkToOhter">
                    Back to home
                  </Link>
                </Grid>
              </Paper>
            </Grid>
            </div>
          )
    }
}

VerifyEmail.propTypes = {
    auth: PropTypes.object.isRequired,
    verifyEmailToken: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    auth: state.auth
});

export default connect(
    mapStateToProps,
    { verifyEmailToken }
)(VerifyEmail);
