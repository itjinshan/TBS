var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var axios = require('axios');
var Trip = require('../DB_Models/DB_Trip');
var { generateMockItinerary } = require('../Services/mockItinerary');
var amapPlaces = require('../Services/amapPlaces');
var generateAccessToken = require('../Config/jwtgenerator');

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

// Real place lookup via Amap (see CLAUDE.md, "Planned: Lodging Flow", action
// item #2). Falls back to a single unverified candidate — today's prior
// placeholder behavior — if the API call fails or turns up nothing, so the
// stage machine keeps moving even without a working key/connection.
function lookupAccommodationCandidates(query, city) {
    return amapPlaces.searchPlaces(query, city)
        .then(function (candidates) {
            return candidates.length ? candidates : [fallbackCandidate(query)];
        })
        .catch(function (err) {
            console.error('Accommodation lookup failed:', err.message);
            return [fallbackCandidate(query)];
        });
}

function fallbackCandidate(query) {
    return { Name: query.trim(), Address: 'Address not verified — lookup unavailable', Latitude: null, Longitude: null };
}

// Picks an item out of a candidate/suggestion list by name (substring match)
// or by its 1-based position in the list, as presented to the user in chat.
function pickFromList(list, message) {
    var text = (message || '').trim();
    var lowerText = text.toLowerCase();
    var byPosition = list[parseInt(text, 10) - 1];
    if (byPosition) return byPosition;
    return list.find(function (item) { return lowerText.includes(item.Name.toLowerCase()); });
}

function fallbackSuggestions(tripBrief) {
    var destination = tripBrief.destination || 'your destination';
    return [
        { Name: 'Suggested stay #1 in ' + destination, Address: 'Address pending — DS-Service unavailable', Latitude: null, Longitude: null },
        { Name: 'Suggested stay #2 in ' + destination, Address: 'Address pending — DS-Service unavailable', Latitude: null, Longitude: null }
    ];
}

// Real suggestions via DS-Service's POST /datasourcing/sourceaccommodations
// (see CLAUDE.md, "Planned: Lodging Flow", action item #6). Falls back to a
// placeholder pair — today's prior behavior — if DS-Service is unreachable
// or returns nothing, so the stage machine keeps moving either way.
function suggestAccommodations(tripBrief) {
    var accessToken = generateAccessToken('', 'deepseek');
    return axios.post(process.env.DS_SERVICE_BASEURL + '/datasourcing/sourceaccommodations', {
        token: accessToken,
        ds: 'deepseek',
        city: tripBrief.destination,
        budget: tripBrief.budget
    }).then(function (res) {
        var accommodations = res.data.accommodations || [];
        if (!accommodations.length) {
            return fallbackSuggestions(tripBrief);
        }
        return accommodations.map(function (a) {
            return { Name: a.Name, Address: a.Address, Latitude: a.Latitude, Longitude: a.Longitude };
        });
    }).catch(function (err) {
        console.error('Accommodation suggestion lookup failed:', err.message);
        return fallbackSuggestions(tripBrief);
    });
}

router.post('/intake', function (req, res) {
    var message = req.body.message || '';
    var tripBrief = req.body.tripBrief || {};
    var stage = tripBrief.intakeStage || STAGES.DESTINATION;

    function respond(extractedFields, reply, nextStage) {
        extractedFields.intakeStage = nextStage;
        res.json({ reply: reply, extractedFields: extractedFields, stage: nextStage });
    }

    function respondError(err) {
        console.error('Trip intake error:', err);
        res.status(502).json({ message: 'Something went wrong while processing that — please try again.' });
    }

    // Runs an Amap lookup and presents every match for the user to confirm —
    // stays in ACCOMMODATION_CONFIRM either way; a second message either picks
    // one of these candidates or (if nothing matches) triggers a fresh search.
    function searchAndPresent(query) {
        lookupAccommodationCandidates(query, tripBrief.destination)
            .then(function (candidates) {
                var listing = candidates.map(function (c, i) {
                    return (i + 1) + '. ' + c.Name + ' — ' + c.Address;
                }).join('; ');
                var reply = (candidates.length > 1 ? 'I found a few matches' : 'I found this match') +
                    ' for "' + query.trim() + '": ' + listing +
                    '. Which one is yours? (reply with the name or number, or type the name again to search differently)';
                respond({ accommodationCandidates: candidates }, reply, STAGES.ACCOMMODATION_CONFIRM);
            })
            .catch(respondError);
    }

    switch (stage) {
        case STAGES.DESTINATION: {
            var destination = extractDestination(message);
            if (destination) {
                respond(
                    { destination: destination },
                    'Got it — ' + destination + '. Do you already have a place to stay booked or in mind?',
                    STAGES.ACCOMMODATION_CHOICE
                );
            } else {
                respond({}, 'Where are you headed?', STAGES.DESTINATION);
            }
            break;
        }

        case STAGES.ACCOMMODATION_CHOICE: {
            var choice = extractYesNo(message);
            if (choice === 'yes') {
                respond(
                    { accommodationChoice: 'has_place' },
                    "Great — what's the name (and city, if it helps) of the place? I'll look it up.",
                    STAGES.ACCOMMODATION_CONFIRM
                );
            } else if (choice === 'no') {
                respond(
                    { accommodationChoice: 'no_place' },
                    "No problem — what's your lodging budget (budget, mid-range, or luxury), and any living preferences (e.g. central location, quiet neighborhood, hotel vs. apartment)?",
                    STAGES.BUDGET_LIVING_PREF
                );
            } else {
                respond({}, 'Just to confirm — do you already have a place booked or in mind? (yes/no)', STAGES.ACCOMMODATION_CHOICE);
            }
            break;
        }

        case STAGES.ACCOMMODATION_CONFIRM: {
            var existingCandidates = tripBrief.accommodationCandidates || [];
            var picked = existingCandidates.length ? pickFromList(existingCandidates, message) : undefined;

            if (picked) {
                var extractedFields = { accommodation: Object.assign({}, picked, { Source: 'user-provided' }) };
                var afterConfirm = nextOtherPrefQuestion(Object.assign({}, tripBrief, extractedFields));
                if (afterConfirm) {
                    respond(extractedFields, 'Got it — ' + picked.Name + '. ' + afterConfirm.question, STAGES.OTHER_PREFS);
                } else {
                    respond(extractedFields, 'Got it — ' + picked.Name + ". I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
                }
            } else {
                searchAndPresent(message);
            }
            break;
        }

        case STAGES.BUDGET_LIVING_PREF: {
            var budgetPrefs = extractOtherPrefs(message);
            var livingPrefFields = { livingPreference: message.trim() };
            if (budgetPrefs.budget) livingPrefFields.budget = budgetPrefs.budget;

            var firstOtherQuestion = nextOtherPrefQuestion(Object.assign({}, tripBrief, livingPrefFields));
            if (firstOtherQuestion) {
                respond(livingPrefFields, 'Got it. ' + firstOtherQuestion.question, STAGES.OTHER_PREFS);
            } else {
                respond(livingPrefFields, "Got it — I've got everything I need. Let me pull together some lodging suggestions.", STAGES.SUGGEST_ACCOMMODATION);
            }
            break;
        }

        case STAGES.OTHER_PREFS: {
            var otherPrefFields = extractOtherPrefs(message);
            var mergedBrief = Object.assign({}, tripBrief, otherPrefFields);
            var otherQuestion = nextOtherPrefQuestion(mergedBrief);

            if (otherQuestion) {
                respond(otherPrefFields, otherQuestion.question, STAGES.OTHER_PREFS);
            } else if (mergedBrief.accommodationChoice === 'no_place') {
                suggestAccommodations(mergedBrief)
                    .then(function (suggestions) {
                        otherPrefFields.accommodationSuggestions = suggestions;
                        var suggestionReply = 'Here are a few lodging options that fit your budget: ' +
                            suggestions.map(function (s, i) { return (i + 1) + '. ' + s.Name; }).join(', ') +
                            '. Which one would you like to go with?';
                        respond(otherPrefFields, suggestionReply, STAGES.SUGGEST_ACCOMMODATION);
                    })
                    .catch(respondError);
            } else {
                respond(otherPrefFields, "I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
            }
            break;
        }

        case STAGES.SUGGEST_ACCOMMODATION: {
            var suggestionList = tripBrief.accommodationSuggestions || [];
            var pickedSuggestion = pickFromList(suggestionList, message) || suggestionList[0];

            if (pickedSuggestion) {
                respond(
                    { accommodation: Object.assign({}, pickedSuggestion, { Source: 'suggested' }) },
                    'Great choice — ' + pickedSuggestion.Name + ". I've got everything I need — hit Generate Itinerary whenever you're ready!",
                    STAGES.READY
                );
            } else {
                respond({}, 'Which of those options would you like to go with?', STAGES.SUGGEST_ACCOMMODATION);
            }
            break;
        }

        case STAGES.READY:
        default: {
            respond(extractOtherPrefs(message), "I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
            break;
        }
    }
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
        NumOfTravelers: body.numOfTravelers,
        Budget: body.budget,
        Preferences: body.preferences,
        Accommodation: body.accommodation,
        LivingPreference: body.livingPreference,
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
