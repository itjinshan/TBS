import React from "react";
import "./Footer.css";
import Grid from "@mui/material/Grid2";
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';

function Footer() {
  return (
    <footer id="footer">
      <div className="footerLayout">
        <a
          href="https://www.facebook.com"
          className="footerMenuLink"
          style={{ color: "white" }}
          ><FacebookIcon style={{fontSize:50}}/>
        </a>
        <a
          href="https://www.instagram.com"
          className="footerMenuLink"
          style={{ color: "white" }}
          ><InstagramIcon style={{fontSize:50}}/>
        </a>
      </div>
      <div className="footerLayout" style={{paddingTop:"1%"}} >
        Copyright © 2025 Travel Buddy
      </div>
    </footer>
  );
}

export default Footer;