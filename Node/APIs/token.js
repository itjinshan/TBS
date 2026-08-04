var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');

var User = require('../DB_Models/DB_User');

// Function to generate JWT Access Token
var generateAccessToken = require('../Config/jwtgenerator');

// Redeem a still-valid RefreshToken for a fresh AccessToken (and a rotated
// RefreshToken). This is what the frontend's axios interceptor calls when a
// request comes back 401 because the AccessToken expired.
router.post('/refresh', (req, res) => {
    const RefreshToken = req.body.RefreshToken;
    if (!RefreshToken) {
        return res.status(400).json({ message: 'Missing RefreshToken' });
    }

    jwt.verify(RefreshToken, process.env.REFRESHSECRETE, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Refresh token invalid or expired' });
        }
        User.findById(decoded.UserID)
            .then(user => {
                if (!user) {
                    return res.status(401).json({ message: 'User not found' });
                }
                const AccessToken = generateAccessToken(user, 'auth');
                const NewRefreshToken = generateAccessToken(user, 'refresh');
                res.json({
                    AccessToken: 'Bearer ' + AccessToken,
                    RefreshToken: NewRefreshToken
                });
            })
            .catch(err => res.status(500).json({ message: 'Error refreshing token' }));
    });
});

module.exports = router;
