import React, { Component } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  IconButton,
  Typography,
  Alert
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import TBSLogo from "../../images/tbs_logo.png";
import { verifyEmailToken, resetVerifyStatus } from "../../actions/authAction";
import withRouter from "../../utils/withRouter";
import "./LoginModal.css"; // Reusing the same CSS as the other auth modals

// Maps the backend's fixed set of verify-email outcomes to translation keys
// under auth.verifyEmail.status — the backend returns a small, enumerable
// set of codes for this endpoint specifically, unlike the free-form
// server-generated text elsewhere (chatbot replies, login error strings)
// that would need real backend i18n to translate.
const STATUS_KEY_BY_CODE = {
    missing_token: 'missingToken',
    expired: 'expired',
    not_found: 'notFound',
    already_verified: 'alreadyVerified',
    success: 'success',
    error: 'error'
};

class VerifyEmail extends Component {
    componentDidMount() {
        const VerificationToken = window.location.search.split("=")[1];
        this.props.verifyEmailToken(VerificationToken);
    }

    componentWillUnmount() {
        this.props.resetVerifyStatus();
    }

    handleClose = () => {
        this.props.navigate("/");
    };

    render() {
        const { verifyStatus, verifyStatusCode, verifyStatusMSG } = this.props.auth;
        const { t } = this.props;
        const statusKey = STATUS_KEY_BY_CODE[verifyStatusCode];
        const statusText = statusKey ? t(`auth.verifyEmail.status.${statusKey}`) : verifyStatusMSG;

        return (
            <Dialog
                open
                onClose={this.handleClose}
                maxWidth="xs"
                fullWidth
                className="login-modal"
                PaperProps={{ style: { borderRadius: 16 } }}
            >
                <div className="modal-header">
                    <IconButton className="close-btn" onClick={this.handleClose} aria-label="close">
                        <CloseIcon />
                    </IconButton>
                    <img src={TBSLogo} alt="Logo" className="modal-logo" />
                    <Typography className="modal-title">{t('auth.verifyEmail.title')}</Typography>
                </div>

                <DialogContent className="modal-content">
                    {verifyStatus === null
                        ? <Typography>{t('auth.verifyEmail.verifying')}</Typography>
                        : <Alert severity={verifyStatus ? "success" : "warning"}>{statusText}</Alert>
                    }

                    <div className="other-footer-links">
                        <a
                            href="#"
                            className="link"
                            onClick={(e) => {
                                e.preventDefault();
                                this.handleClose();
                            }}
                        >
                            {t('auth.verifyEmail.backToHome')}
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }
}

VerifyEmail.propTypes = {
    auth: PropTypes.object.isRequired,
    verifyEmailToken: PropTypes.func.isRequired,
    resetVerifyStatus: PropTypes.func.isRequired,
    navigate: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

const mapStateToProps = state => ({
    auth: state.auth
});

export default connect(
    mapStateToProps,
    { verifyEmailToken, resetVerifyStatus }
)(withTranslation()(withRouter(VerifyEmail)));
