import React from "react";
import "./Footer.css";
// media imports
import TBSLogo from "../../images/tbs_logo.png";
import { FaFacebook, FaTwitter, FaInstagram } from 'react-icons/fa';
import { SiXiaohongshu, SiTiktok, SiPinterest, SiWechat } from 'react-icons/si';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-logo">
          <img src={TBSLogo} alt="Eazigo Logo" />
        </div>

        <div className="footer-links">
          <div className="link-column">
            <h4>Company</h4>
            <ul>
              <li><a href="/about">About Us</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </div>

          <div className="link-column">
            <h4>Resources</h4>
            <ul>
              <li><a href="/blog">Blog</a></li>
              <li><a href="/docs">Documentation</a></li>
              <li><a href="/support">Support</a></li>
            </ul>
          </div>

          <div className="link-column">
            <h4>Legal</h4>
            <ul>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/cookies">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-social-grid">
          <div className="social-row">
            <a href="#" aria-label="Facebook"><FaFacebook className="social-icon" /></a>
            <a href="#" aria-label="Twitter"><FaTwitter className="social-icon" /></a>
          </div>
          <div className="social-row">
            <a href="#" aria-label="Xiaohongshu"><SiXiaohongshu className="social-icon xiaohongshu" /></a>
            <a href="#" aria-label="Instagram"><FaInstagram className="social-icon" /></a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Eazigo. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;