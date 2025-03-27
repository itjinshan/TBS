var express = require('express');
var axios = require('axios');
var router = express.Router();
var generateAccessToken = require('../Config/jwtgenerator');

// only for testing purpose, remove after testing
router.post('/', async (req, res) => {
    if (req.body.query) {
        let accessToken = generateAccessToken('', 'deepseek');
        let tripParams = {
            token: accessToken,
            query: req.body.query
        };
        try {
            const response = 
                await axios.post(
                    process.env.DS_SERVICE_BASEURL + '/deepseek/plantrip', 
                    tripParams,
                );
            res.json(response.data);
        } catch (err) {
            console.log(err);
            res.status(400).json(err);
        }
    } else {
        res.status(400).json({ message: 'Invalid query' });
    }
});

router.post('/plantrip', async (req, res) => {
    let accessToken = generateAccessToken('', 'deepseek');
    let tripParams = {
        token: accessToken,
        destination: req.body.destination,
        duration: req.body.duration,
        totalTravelers: req.body.totalTravelers,
        budget: req.body.budget,
        date: req.body.date
    };
    try {
        const response = 
            await axios.post(
                process.env.DS_SERVICE_BASEURL + '/deepseek/plantrip', 
                tripParams,
            );
        res.json(response.data);
    } catch (err) {
        console.log(err);
        res.status(400).json(err);
    }
});

module.exports = router;