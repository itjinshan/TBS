var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var axios = require('axios');
var Trip = require('../DB_Models/DB_Trip');
var { generateFallbackItinerary } = require('../Services/fallbackItinerary');
var { arrangeIntoDays, SPOTS_PER_DAY, SPOT_REQUEST_BUFFER_MULTIPLIER } = require('../Services/itineraryPlanner');
var spotSourcing = require('../Services/spotSourcing');
var nluExtraction = require('../Services/nluExtraction');
var amapPlaces = require('../Services/amapPlaces');
var generateAccessToken = require('../Config/jwtgenerator');

var OTHER_PREF_FIELDS = ['duration', 'numOfTravelers', 'budget', 'pace'];

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
    budget: "What's your budget style — budget, mid-range, or luxury?",
    pace: "What pace are you after — relaxed, standard, or packed?"
};

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
                    return (i + 1) + '. ' + c.Name + '\n' + c.Address;
                }).join('\n\n');
                var intro = candidates.length > 1
                    ? 'Here are some similar hotels, could you please confirm:'
                    : 'Here\'s what I found for "' + query.trim() + '", could you please confirm:';
                var reply = intro + '\n\n' + listing +
                    '\n\nWhich one is yours? (reply with the name or number, or type the name again to search differently)';
                respond({ accommodationCandidates: candidates }, reply, STAGES.ACCOMMODATION_CONFIRM);
            })
            .catch(respondError);
    }

    switch (stage) {
        case STAGES.DESTINATION: {
            nluExtraction.extractDestination(message)
                .then(function (destination) {
                    if (destination) {
                        respond(
                            { destination: destination },
                            'Got it — ' + destination + '. Do you already have a place to stay booked or in mind?',
                            STAGES.ACCOMMODATION_CHOICE
                        );
                    } else {
                        respond({}, 'Where are you headed?', STAGES.DESTINATION);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.ACCOMMODATION_CHOICE: {
            nluExtraction.extractYesNo(message, 'whether the traveler already has a place to stay booked or in mind')
                .then(function (choice) {
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
                })
                .catch(respondError);
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
            nluExtraction.extractOtherPrefs(message)
                .then(function (budgetPrefs) {
                    var livingPrefFields = { livingPreference: message.trim() };
                    if (budgetPrefs.budget) livingPrefFields.budget = budgetPrefs.budget;

                    var firstOtherQuestion = nextOtherPrefQuestion(Object.assign({}, tripBrief, livingPrefFields));
                    if (firstOtherQuestion) {
                        respond(livingPrefFields, 'Got it. ' + firstOtherQuestion.question, STAGES.OTHER_PREFS);
                    } else {
                        respond(livingPrefFields, "Got it — I've got everything I need. Let me pull together some lodging suggestions.", STAGES.SUGGEST_ACCOMMODATION);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.OTHER_PREFS: {
            nluExtraction.extractOtherPrefs(message)
                .then(function (otherPrefFields) {
                    var mergedBrief = Object.assign({}, tripBrief, otherPrefFields);
                    var otherQuestion = nextOtherPrefQuestion(mergedBrief);

                    if (otherQuestion) {
                        respond(otherPrefFields, otherQuestion.question, STAGES.OTHER_PREFS);
                    } else if (mergedBrief.accommodationChoice === 'no_place') {
                        return suggestAccommodations(mergedBrief)
                            .then(function (suggestions) {
                                otherPrefFields.accommodationSuggestions = suggestions;
                                var suggestionReply = 'Here are a few lodging options that fit your budget: ' +
                                    suggestions.map(function (s, i) { return (i + 1) + '. ' + s.Name + ' (' + s.Address + ')'; }).join(', ') +
                                    '. Which one would you like to go with?';
                                respond(otherPrefFields, suggestionReply, STAGES.SUGGEST_ACCOMMODATION);
                            });
                    } else {
                        respond(otherPrefFields, "I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
                    }
                })
                .catch(respondError);
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
            nluExtraction.extractOtherPrefs(message)
                .then(function (otherPrefFields) {
                    respond(otherPrefFields, "I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
                })
                .catch(respondError);
            break;
        }
    }
});

// Real itinerary generation via Services/spotSourcing.js (DS-Service) +
// Services/itineraryPlanner.js (geographic day clustering) — see CLAUDE.md,
// "Planned: Real Trip-Generation Data". Falls back to
// Services/fallbackItinerary.js only on a DS-Service network/HTTP error or
// zero spots returned — a partial real result (fewer spots than requested
// for an obscure city) still proceeds, since the planner already degrades
// gracefully rather than crashing.
router.post('/generate', function (req, res) {
    var tripBrief = req.body.tripBrief;
    if (!tripBrief || !tripBrief.destination) {
        return res.status(400).json({ message: 'Missing required field: destination' });
    }

    var duration = Math.max(1, Math.min(14, Number(tripBrief.duration) || 3));
    // Padded since day-sizing is now time-based, not a hard per-day count —
    // see SPOT_REQUEST_BUFFER_MULTIPLIER in itineraryPlanner.js.
    var minSpots = Math.max(6, Math.ceil(duration * SPOTS_PER_DAY * SPOT_REQUEST_BUFFER_MULTIPLIER));

    spotSourcing.sourceSpots(tripBrief.destination, minSpots)
        .then(function (spots) {
            if (!spots.length) {
                return res.json(generateFallbackItinerary(tripBrief));
            }
            var days = arrangeIntoDays(spots, duration, tripBrief.accommodation, tripBrief.pace);
            res.json({ destination: tripBrief.destination, days: days, accommodation: tripBrief.accommodation || null });
        })
        .catch(function (err) {
            console.error('Real itinerary generation failed, falling back:', err.message);
            res.json(generateFallbackItinerary(tripBrief));
        });
});

router.post('/', passport.authenticate('jwt', { session: false }), function (req, res) {
    var body = req.body;
    var trip = new Trip({
        Owner: req.user.id,
        Destination: body.destination,
        Duration: body.days ? body.days.length : 0,
        NumOfTravelers: body.numOfTravelers,
        Budget: body.budget,
        Pace: body.pace,
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
