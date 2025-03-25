var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');

// Function to generate JWT Access Token  
var generateAccessToken = require('../Config/jwtgenerator');

router.get('/', (req, res) => {
    if(req.body.usage){
        switch(req.body.usage){
            case 'deepseek':
                return res.json({token: generateAccessToken('', req.body.usage)});
            case 'auth':
                return res.json({token: generateAccessToken(req.user, req.body.usage)});
        }
    }
    else
        res.status(400).send('Invalid parameters');
});

module.exports = router;