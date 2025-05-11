import React, { useState, useRef, useEffect } from 'react'
import PropTypes from "prop-types";
import { useSelector, useDispatch, connect } from "react-redux";
import { Link } from "react-router-dom";
import { logoutUser, getProfileInfo } from "../../actions/authAction";
import setAuthToken from "../../utils/setAuthToken";
import LoginModal from '../auth/LoginModal';
// style imports
import { FaUserCircle } from 'react-icons/fa';
import "./Navbar.css";
// media imports
import TBSLogo from "../../images/tbs_logo.png";

const Navbar = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false); // Modal state
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      // Fetch user profile info when authenticated
      dispatch(getProfileInfo());
      setShowDropdown(false);
      const token = localStorage.getItem("AccessToken");

    }
  }, [isAuthenticated, dispatch]);

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
    setShowLoginModal(true);
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    setAuthToken(false);
    setShowDropdown(false);
    setShowLoginModal(false);
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  return (
    <>
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <div className="navbar-logo">
            <img src={TBSLogo} alt="Eazigo Logo" />
          </div>
        </Link>
        
        <div className="navbar-auth">
          {isAuthenticated ? (
              <div className="profile-container" ref={dropdownRef}>
              <div className="profile-info" onClick={toggleDropdown}>
                <div className="profile-pic">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" />
                  ) : (
                    <FaUserCircle size={24} />
                  )}
                </div>
                <span className="username">{user?.FirstName || 'User'}</span>
              </div>
              
              {showDropdown && (
                <div className="dropdown-menu">
                  <div className="dropdown-item">My Profile</div>
                  <div className="dropdown-item">Settings</div>
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

    {!isAuthenticated && (
      <>
      {/* Login Modal */}
        <LoginModal 
        open={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
      </>
    )}
    </>
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
