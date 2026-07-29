var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var Trip = require('../DB_Models/DB_Trip');
var { generateMockItinerary } = require('../Services/mockItinerary');

var KNOWN_DESTINATIONS = [
    'bali', 'paris', 'tokyo', 'new york', 'santorini', 'sydney', 'beijing', 'shanghai'
];

var OTHER_PREF_FIELDS = ['duration', 'numOfTravelers', 'budget'];

// Conversation stages for trip intake. Accommodation is settled right after
// destination (and before the rest of the trip preferences) because it
// decides the starting location for each day of the generated itinerary —
// see CLAUDE.md, "Planned: Lodging Flow".
var STAGES = {
    DESTINATION: 'destination',
    ACCOMMODATION_CHOICE: 'accommodation_choice',
    ACCOMMODATION_CONFIRM: 'accommodation_confirm',
    BUDGET_LIVING_PREF: 'budget_living_pref',
    OTHER_PREFS: 'other_prefs',
    SUGGEST_ACCOMMODATION: 'suggest_accommodation',
    READY: 'ready'
};

var OTHER_PREF_QUESTIONS = {
    duration: "How many days are you planning to travel?",
    numOfTravelers: "How many people will be traveling?",
    budget: "What's your budget style — budget, mid-range, or luxury?"
};

// Rule-based slot extraction. DS-Service has no trip-intake/extraction endpoint
// today (see /Users/alexjiang/DS-Service/APIs/deepseek.ts), so this is a
// placeholder that can be swapped for a real LLM extraction call later behind
// the same { reply, extractedFields, stage } response shape.
function extractDestination(message) {
    var text = (message || '').toLowerCase();
    var known = KNOWN_DESTINATIONS.find(function (city) { return text.includes(city); });
    if (known) return known.replace(/\b\w/g, function (c) { return c.toUpperCase(); });

    var destMatch = message.match(/\b(?:to|in|visit(?:ing)?)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*)/);
    return destMatch ? destMatch[1] : undefined;
}

function extractOtherPrefs(message) {
    var text = (message || '').toLowerCase();
    var extracted = {};

    var durationMatch = text.match(/(\d+)\s*-?\s*(day|days|night|nights)/);
    if (durationMatch) extracted.duration = parseInt(durationMatch[1], 10);

    var travelersMatch = text.match(/(\d+)\s*(people|person|travelers|traveler|adults|pax)/);
    if (travelersMatch) {
        extracted.numOfTravelers = parseInt(travelersMatch[1], 10);
    } else if (/\b(solo|myself|just me)\b/.test(text)) {
        extracted.numOfTravelers = 1;
    } else if (/\bcouple\b/.test(text)) {
        extracted.numOfTravelers = 2;
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

function extractYesNo(message) {
    var text = (message || '').toLowerCase();
    // Check negative cues first — a message like "no, haven't booked anything"
    // still contains "booked", which would otherwise false-match the yes cues.
    if (/\b(no|nope|not yet|haven't|have not|don't have|no idea|not sure|not booked)\b/.test(text)) return 'no';
    if (/\b(yes|yeah|yep|already booked|already have|have one|have a place|booked)\b/.test(text)) return 'yes';
    return undefined;
}

function nextOtherPrefQuestion(mergedBrief) {
    var missing = OTHER_PREF_FIELDS.filter(function (field) {
        return mergedBrief[field] === undefined || mergedBrief[field] === null || mergedBrief[field] === '';
    });
    return missing.length ? { field: missing[0], question: OTHER_PREF_QUESTIONS[missing[0]] } : null;
}

// Stub: real place lookup is a planned Amap integration (see CLAUDE.md,
// "Planned: Lodging Flow", action item #2). Until wired up, treat whatever
// the user typed as a single unverified candidate so the rest of the stage
// machine can be exercised end-to-end.
function lookupAccommodationCandidates(message) {
    return [{ name: message.trim(), address: 'Address lookup pending — see CLAUDE.md lodging plan' }];
}

// Stub: real suggestions come from a planned DS-Service endpoint
// (POST /datasourcing/sourceaccommodations, see CLAUDE.md action item #4).
function suggestAccommodations(tripBrief) {
    var destination = tripBrief.destination || 'your destination';
    return [
        { name: 'Suggested stay #1 in ' + destination, address: 'Address pending — see CLAUDE.md lodging plan' },
        { name: 'Suggested stay #2 in ' + destination, address: 'Address pending — see CLAUDE.md lodging plan' }
    ];
}

router.post('/intake', function (req, res) {
    var message = req.body.message || '';
    var tripBrief = req.body.tripBrief || {};
    var stage = tripBrief.intakeStage || STAGES.DESTINATION;

    var extractedFields = {};
    var reply = '';
    var nextStage = stage;

    switch (stage) {
        case STAGES.DESTINATION: {
            var destination = extractDestination(message);
            if (destination) {
                extractedFields.destination = destination;
                nextStage = STAGES.ACCOMMODATION_CHOICE;
                reply = 'Got it — ' + destination + '. Do you already have a place to stay booked or in mind?';
            } else {
                reply = 'Where are you headed?';
            }
            break;
        }

        case STAGES.ACCOMMODATION_CHOICE: {
            var choice = extractYesNo(message);
            if (choice === 'yes') {
                extractedFields.accommodationChoice = 'has_place';
                nextStage = STAGES.ACCOMMODATION_CONFIRM;
                reply = "Great — what's the name (and city, if it helps) of the place? I'll look it up.";
            } else if (choice === 'no') {
                extractedFields.accommodationChoice = 'no_place';
                nextStage = STAGES.BUDGET_LIVING_PREF;
                reply = "No problem — what's your lodging budget (budget, mid-range, or luxury), and any living preferences (e.g. central location, quiet neighborhood, hotel vs. apartment)?";
            } else {
                reply = 'Just to confirm — do you already have a place booked or in mind? (yes/no)';
            }
            break;
        }

        case STAGES.ACCOMMODATION_CONFIRM: {
            var candidates = lookupAccommodationCandidates(message);
            extractedFields.accommodationCandidates = candidates;
            extractedFields.accommodation = candidates[0];

            var afterConfirm = nextOtherPrefQuestion(Object.assign({}, tripBrief, extractedFields));
            if (afterConfirm) {
                nextStage = STAGES.OTHER_PREFS;
                reply = 'Got it — ' + candidates[0].name + '. ' + afterConfirm.question;
            } else {
                nextStage = STAGES.READY;
                reply = 'Got it — ' + candidates[0].name + ". I've got everything I need — hit Generate Itinerary whenever you're ready!";
            }
            break;
        }

        case STAGES.BUDGET_LIVING_PREF: {
            var budgetPrefs = extractOtherPrefs(message);
            if (budgetPrefs.budget) extractedFields.budget = budgetPrefs.budget;
            extractedFields.livingPreference = message.trim();

            var firstOtherQuestion = nextOtherPrefQuestion(Object.assign({}, tripBrief, extractedFields));
            if (firstOtherQuestion) {
                nextStage = STAGES.OTHER_PREFS;
                reply = 'Got it. ' + firstOtherQuestion.question;
            } else {
                nextStage = STAGES.SUGGEST_ACCOMMODATION;
                reply = "Got it — I've got everything I need. Let me pull together some lodging suggestions.";
            }
            break;
        }

        case STAGES.OTHER_PREFS: {
            Object.assign(extractedFields, extractOtherPrefs(message));
            var mergedBrief = Object.assign({}, tripBrief, extractedFields);
            var otherQuestion = nextOtherPrefQuestion(mergedBrief);

            if (otherQuestion) {
                reply = otherQuestion.question;
            } else if (mergedBrief.accommodationChoice === 'no_place') {
                nextStage = STAGES.SUGGEST_ACCOMMODATION;
                var suggestions = suggestAccommodations(mergedBrief);
                extractedFields.accommodationSuggestions = suggestions;
                reply = 'Here are a few lodging options that fit your budget: ' +
                    suggestions.map(function (s) { return s.name; }).join(', ') + '. Which one would you like to go with?';
            } else {
                nextStage = STAGES.READY;
                reply = "I've got everything I need — hit Generate Itinerary whenever you're ready!";
            }
            break;
        }

        case STAGES.SUGGEST_ACCOMMODATION: {
            var suggestionList = tripBrief.accommodationSuggestions || [];
            var picked = suggestionList.find(function (s) {
                return message.toLowerCase().includes(s.name.toLowerCase()) ||
                    message.trim() === String(suggestionList.indexOf(s) + 1);
            }) || suggestionList[0];

            if (picked) {
                extractedFields.accommodation = picked;
                nextStage = STAGES.READY;
                reply = 'Great choice — ' + picked.name + ". I've got everything I need — hit Generate Itinerary whenever you're ready!";
            } else {
                reply = 'Which of those options would you like to go with?';
            }
            break;
        }

        case STAGES.READY:
        default: {
            Object.assign(extractedFields, extractOtherPrefs(message));
            reply = "I've got everything I need — hit Generate Itinerary whenever you're ready!";
            nextStage = STAGES.READY;
            break;
        }
    }

    extractedFields.intakeStage = nextStage;

    res.json({ reply: reply, extractedFields: extractedFields, stage: nextStage });
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
