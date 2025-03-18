import React from "react";
import { Link } from "react-router-dom";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";

export default (class NavbarMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = { authenticated: null, anchorEl: null };

    this.logoutUser = this.logoutUser.bind(this);
    
  }

  handleClick = event => {
    this.setState({ anchorEl: event.currentTarget });
  };

  handleClose = () => {
    this.setState({ anchorEl: null });
  };

  logoutUser(e) {
    this.handleClose();
    this.props.onLogoutClick(e);
  }

  render() {
    const { anchorEl } = this.state;
    const open = Boolean(anchorEl);
    return (
      <div>
        <IconButton
          aria-label="More"
          aria-owns={open ? "long-menu" : undefined}
          aria-haspopup="true"
          onClick={this.handleClick}
          size="small"
          className="moreBurger"
        >
          <span className="moreBurgerText">More</span> <MenuIcon className="menuBurgerLogedIn" fontSize="large"/>
        </IconButton>
        <Menu
          id="fade-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={this.handleClose}
          TransitionComponent={Fade}
        >
          <Link className="navBurger" to="/" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>Home</MenuItem>
          </Link>
          <Link to="/profile" style={{color:"black"}}>
            <MenuItem onClick={this.handleClose}>Profile</MenuItem>
          </Link>
          <Link className="navBurger" to="/class-overview" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>Courses</MenuItem>
          </Link>
          <Link className="About" to="/about" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>About</MenuItem>
          </Link>

          <MenuItem onClick={this.logoutUser}>Logout</MenuItem>
        </Menu>
      </div>
    );
  }
});