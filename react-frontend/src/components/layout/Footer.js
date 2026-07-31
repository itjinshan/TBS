import React from "react";
import { useTranslation } from "react-i18next";
import "./Footer.css";
// media imports
import TBSLogo from "../../images/tbs_logo.png";
import { FaFacebook, FaTwitter, FaInstagram } from 'react-icons/fa';
import { SiXiaohongshu, SiTiktok, SiPinterest, SiWechat } from 'react-icons/si';
import WeChatIcon from '../../utils/WechatIcon';

const Footer = () => {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-logo">
          <img src={TBSLogo} alt="Eazigo Logo" />
        </div>

        <div className="footer-links">
          <div className="link-column">
            <h4>{t('footer.company')}</h4>
            <ul>
              <li><a href="/about">{t('footer.aboutUs')}</a></li>
              <li><a href="/contact">{t('footer.contact')}</a></li>
            </ul>
          </div>

          <div className="link-column">
            <h4>{t('footer.resources')}</h4>
            <ul>
              <li><a href="/blog">{t('footer.blog')}</a></li>
              <li><a href="/docs">{t('footer.documentation')}</a></li>
              <li><a href="/support">{t('footer.support')}</a></li>
            </ul>
          </div>

          <div className="link-column">
            <h4>{t('footer.legal')}</h4>
            <ul>
              <li><a href="/privacy">{t('footer.privacyPolicy')}</a></li>
              <li><a href="/terms">{t('footer.termsOfService')}</a></li>
              <li><a href="/cookies">{t('footer.cookiePolicy')}</a></li>
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
        <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
};

export default Footer;