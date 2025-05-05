import React, { useState, useRef, useEffect } from 'react'
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { logoutUser, getProfileInfo } from "../../actions/authAction";
import setAuthToken from "../../utils/setAuthToken";
import "./Navbar.css";
// media imports
import TBSLogo from "../../images/tbs_logo.png";

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('John Doe');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowDropdown(false);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="navbar-logo">
            <img src={TBSLogo} alt="Eazigo Logo" />
          </div>
        </Link>
        
        <div className="navbar-auth">
          {isLoggedIn ? (
            <div className="profile-container" ref={dropdownRef}>
              <div className="profile-info" onClick={toggleDropdown}>
                <div className="profile-pic">
                  <img 
                    src="https://via.placeholder.com/40x40?text=JD" 
                    alt="Profile" 
                  />
                </div>
                <span className="username">{username}</span>
              </div>
              
              {showDropdown && (
                <div className="dropdown-menu">
                  <div className="dropdown-item">My Profile</div>
                  <div className="dropdown-item">Settings</div>
                  <div className="dropdown-item">Notifications</div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item" onClick={handleLogout}>Logout</div>
                </div>
              )}
            </div>
          ) : (
            <button className="login-btn" onClick={handleLogin}>Login</button>
          )}
        </div>
      </div>
    </nav>
  );
};

Navbar.propTypes = {
  auth: PropTypes.object.isRequired,
};

let mapStateToProps = state => ({
  auth: state.auth,
});

export default connect(
  mapStateToProps,
  { logoutUser, getProfileInfo }
)(Navbar);
