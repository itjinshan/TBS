var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var Trip = require('../DB_Models/DB_Trip');
var { generateMockItinerary } = require('../Services/mockItinerary');

var REQUIRED_FIELDS = ['destination', 'duration', 'travelers', 'budget'];

var KNOWN_DESTINATIONS = [
    'bali', 'paris', 'tokyo', 'new york', 'santorini', 'sydney', 'beijing', 'shanghai'
];

// Rule-based slot extraction. DS-Service has no trip-intake/extraction endpoint
// today (see /Users/alexjiang/DS-Service/APIs/deepseek.ts), so this is a
// placeholder that can be swapped for a real LLM extraction call later behind
// the same { reply, extractedFields, missingRequired } response shape.
function extractFields(message) {
    var text = (message || '').toLowerCase();
    var extracted = {};

    var known = KNOWN_DESTINATIONS.find(function (city) { return text.includes(city); });
    if (known) {
        extracted.destination = known.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    } else {
        var destMatch = message.match(/\b(?:to|in|visit(?:ing)?)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/);
        if (destMatch) extracted.destination = destMatch[1];
    }

    var durationMatch = text.match(/(\d+)\s*-?\s*(day|days|night|nights)/);
    if (durationMatch) extracted.duration = parseInt(durationMatch[1], 10);

    var travelersMatch = text.match(/(\d+)\s*(people|person|travelers|traveler|adults|pax)/);
    if (travelersMatch) {
        extracted.travelers = parseInt(travelersMatch[1], 10);
    } else if (/\b(solo|myself|just me)\b/.test(text)) {
        extracted.travelers = 1;
    } else if (/\bcouple\b/.test(text)) {
        extracted.travelers = 2;
    }

    // Check the more specific tiers first — "budget" as a bare word is a common
    // false positive inside phrases like "mid-range budget" or "what's my budget".
    if (/\b(mid.range|moderate)/.test(text)) {
        extracted.budget = 'mid-range';
    } else if (/\b(luxury|lavish|five.star|5.star)/.test(text)) {
        extracted.budget = 'luxury';
    } else if (/\b(budget|cheap|backpack)/.test(text)) {
        extracted.budget = 'budget';
    }

    return extracted;
}

var FOLLOWUP_QUESTIONS = {
    destination: "Where are you headed?",
    duration: "How many days are you planning to travel?",
    travelers: "How many people will be traveling?",
    budget: "What's your budget style — budget, mid-range, or luxury?"
};

router.post('/intake', function (req, res) {
    var message = req.body.message || '';
    var tripBrief = req.body.tripBrief || {};

    var extractedFields = extractFields(message);
    var mergedBrief = Object.assign({}, tripBrief, extractedFields);

    var missingRequired = REQUIRED_FIELDS.filter(function (field) {
        return mergedBrief[field] === undefined || mergedBrief[field] === null || mergedBrief[field] === '';
    });

    var ackParts = Object.keys(extractedFields).map(function (field) {
        return field + ': ' + extractedFields[field];
    });
    var ack = ackParts.length ? 'Got it — ' + ackParts.join(', ') + '. ' : '';

    var reply = missingRequired.length
        ? ack + FOLLOWUP_QUESTIONS[missingRequired[0]]
        : ack + "I've got everything I need — hit Generate Itinerary whenever you're ready!";

    res.json({ reply: reply, extractedFields: extractedFields, missingRequired: missingRequired });
});

router.post('/generate', function (req, res) {
    var tripBrief = req.body.tripBrief;
    if (!tripBrief || !tripBrief.destination) {
        return res.status(400).json({ message: 'Missing required field: destination' });
    }

    try {
        var itinerary = generateMockItinerary(tripBrief);
        res.json(itinerary);
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Failed to generate itinerary' });
    }
});

router.post('/', passport.authenticate('jwt', { session: false }), function (req, res) {
    var body = req.body;
    var trip = new Trip({
        Owner: req.user.id,
        Destination: body.destination,
        Duration: body.days ? body.days.length : 0,
        Travelers: body.travelers,
        Budget: body.budget,
        Preferences: body.preferences,
        Days: body.days
    });

    trip.save()
        .then(function (saved) { res.json(saved); })
        .catch(function (err) {
            console.log(err);
            res.status(400).json({ message: 'Failed to save trip' });
        });
});

router.get('/:id', passport.authenticate('jwt', { session: false }), function (req, res) {
    Trip.findById(req.params.id)
        .then(function (trip) {
            if (!trip) return res.status(404).json({ message: 'Trip not found' });
            res.json(trip);
        })
        .catch(function (err) {
            console.log(err);
            res.status(400).json({ message: 'Invalid trip id' });
        });
});

module.exports = router;
