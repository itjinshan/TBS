import React, { Component } from 'react'
import PropTypes from "prop-types";
import { connect } from "react-redux";
import Grid from "@mui/material/Grid2";
import { Link } from "react-router-dom";
// import { logoutUser, getProfileInfo } from "../../actions/authAction";
// import setAuthToken from "../util/setAuthToken";

import Logo from "../../images/tbs_logo.png";
import NavbarMenu from "./NavbarMenu";
import NavTabsMenu from "./NavTabMenu";

import "./Navbar.css";




class Navbar extends Component {
    constructor() {
      super();
    //   this.onLogoutClick = this.onLogoutClick.bind(this);
    }

    // onLogoutClick(e) {
    //   e.preventDefault();
    //   this.props.logoutUser();
    // }

    // componentDidMount() {
    //   if (localStorage.AccessToken) {
    //     setAuthToken(localStorage.AccessToken);
    //     this.props.getProfileInfo();
    //   }
    // }

    render() {
        let guestMarkUp =  (
          <Grid
            container
            spacing={0}
            justifyContent="space-evenly"
            alignItems="center"
            direction="row"
            className="positionOpt"
            xs={2}
            sm={5}
            md={5}
            lg={5}
          >
            <Grid className="navStyle" item>
              <Link className="navOpt" to="/">
                  Home
              </Link>
            </Grid>
            <Grid className= "navStyle optionalNav" item>
              <Link className="navOpt" to="/about">
                  About
              </Link>
            </Grid>
            <Grid className="navStyle" item>
              <Link className="navOpt" to="/login">
                  Login
              </Link>
            </Grid>
            <Grid className="navBurger" item>
              <NavTabsMenu />
            </Grid>
          </Grid> 
        );

        // Markup shown on the right hand side of Navbar when user is LOGGED IN.

        // let loggedInMarkup = (
        //   <Grid
        //     container
        //     spacing={0}
        //     justifyContent="space-evenly"
        //     alignItems="right"
        //     direction="row"
        //     className="positionOpt"
        //     xs={4}
        //     sm={6}
        //     md={6}
        //     lg={6}
        //   >
        //     <Grid className="greetingMsg" item>Welcome {this.props.auth.user.FirstName}</Grid>
        //     <Grid className="navStyle" item>
        //       <Link className="navOpt" to="/">
        //           Home
        //       </Link>
        //     </Grid>
        //     <Grid className="navStyle" item>
        //       <Link className="navOpt" to="/class-overview">
        //           Course
        //       </Link>
        //     </Grid>
        //     <Grid className="navStyle" item>
        //       <a className="navOpt" href="https://www.battraininggroup.com/">
        //           LEO/Security
        //       </a>
        //     </Grid>
        //     <Grid className="adjustMenuBurger" item>
        //       <NavbarMenu
        //         onLogoutClick={this.onLogoutClick}
        //         userEmail={this.props.auth.user.Email}
        //         firstName={this.props.auth.user.FirstName}
        //         admin={this.props.auth.user.IsAdmin}
        //         instructor={this.props.auth.user.IsInstructor}
        //       />
        //     </Grid>
        //   </Grid>
        // );


    // Markup shown on the right hand side of Navbar when user is GUEST.
    return (
      <div className="navbarContainer">
        <Grid
          container
          className="navbarContainer headerfont"
          spacing={0}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Grid className="navbarLogo" item>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <Grid
                container
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Grid item>
                  <img
                    className="tbs-logo"
                    src={Logo}
                    alt="TBS Logo"
                  />
                </Grid>
                <Grid item className="companyName text-left">
                  <div className="navTitle">Travel Buddy</div>
                  <div className="navTitle">Your Personal AI Travel Guide</div>
                </Grid>
              </Grid>
            </Link>
          </Grid>
          guestMarkUp
          {/* {this.props.auth.isAuthenticated ? loggedInMarkup : guestMarkUp} */}
        </Grid>
      </div>
    );
  }
}

Navbar.propTypes = {
  auth: PropTypes.object.isRequired,
};

let mapStateToProps = state => ({
  auth: state.auth,
});

export default connect(
  mapStateToProps,
  { }
//   { logoutUser, getProfileInfo }
)(Navbar);
