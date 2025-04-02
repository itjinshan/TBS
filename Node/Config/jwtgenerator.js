// Function to generate JWT Access Token
var jwt = require('jsonwebtoken');

module.exports = function generateAccessToken(user, usage){
    switch(usage){
        case 'auth':
            return jwt.sign(
                {
                    UserID: user.id,
                    FirstName: user.FirstName,
                    LastName: user.LastName
                },
                process.env.ACCESSSECRETE,
                {
                    expiresIn: 3600
                }
            );
        case 'refresh':
            return jwt.sign(
                {
                    UserID: user.id,
                    FirstName: user.FirstName,
                    LastName: user.LastName
                },
                process.env.REFRESHSECRETE
            );
        case 'deepseek':
            return jwt.sign(
                { 
                    API_Usage: usage
                }, 
                process.env.DEEPSEEK_JWT_SECRET,
                {
                    expiresIn: 60
                }
            );
        case 'gdmapservice':
            return jwt.sign(
                { 
                    API_Usage: usage
                }, 
                process.env.GD_MAP_JWT_SECRET,
                {
                    expiresIn: 60
                }
            );
    }

}