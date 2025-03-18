import React from "react";
import { Link } from "react-router-dom";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Fade from "@mui/material/Fade";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";

export default (class NavTabsMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = { authenticated: null, anchorEl: null };
    
  }

  handleClick = event => {
    this.setState({ anchorEl: event.currentTarget });
  };

  handleClose = () => {
    this.setState({ anchorEl: null });
  };


  render() {
    const { anchorEl } = this.state;
    const open = Boolean(anchorEl);
    return (
      <div>
        {/* {console.log(this.props)} */}
        <IconButton
          aria-label="More"
          aria-owns={open ? "long-menu" : undefined}
          aria-haspopup="true"
          onClick={this.handleClick}
        >
          <MenuIcon className="menuBurger" fontSize="large"/>
        </IconButton>
        <Menu
          id="fade-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={this.handleClose}
          TransitionComponent={Fade}
        >
            <Link to="/" style={{color:"black"}}>
                <MenuItem onClick={this.handleClose}>Home</MenuItem>
            </Link>
            <Link to="/about" style={{color:"black"}}>
                <MenuItem onClick={this.handleClose}>About</MenuItem>
            </Link>
            <Link to="/class-overview" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>Courses</MenuItem>
            </Link>
            <Link to="/contact" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>Contact</MenuItem>
            </Link>
            <Link to="/login" style={{color:"black"}}>
              <MenuItem onClick={this.handleClose}>Login</MenuItem>
            </Link>
        </Menu>
      </div>
    );
  }
});