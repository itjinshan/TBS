const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../DB_Models/DB_User');

const opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.ACCESSSECRETE;


module.exports = passport => {
    passport.use(
        new JwtStrategy(opts, (jwt_payload, done) => { // jwt_payload get from users.js by using jwt.sign(payload)
            User.findById(jwt_payload.UserID)
                .then(user => {
                    if (user) {
                        return done(null, user);
                    }
                    return done(null, false);
                })
                .catch(err => console.log(err));
        })
    );
};