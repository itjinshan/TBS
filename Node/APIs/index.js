var express = require('express');
var router = express.Router();

router.get('/index', function(req, res, next){
    res.send('Welcome to the Eazigo server');
});

module.exports = router;