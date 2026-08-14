var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var axios = require('axios');
var Trip = require('../DB_Models/DB_Trip');
var { generateFallbackItinerary } = require('../Services/fallbackItinerary');
var { arrangeIntoDays, replaceSpotInDay, applyAccommodation, sortAccommodationsByProximity, SPOTS_PER_DAY, SPOT_REQUEST_BUFFER_MULTIPLIER } = require('../Services/itineraryPlanner');
var spotSourcing = require('../Services/spotSourcing');
var nluExtraction = require('../Services/nluExtraction');
var amapPlaces = require('../Services/amapPlaces');
var amapRouting = require('../Services/amapRouting');
var generateAccessToken = require('../Config/jwtgenerator');

var OTHER_PREF_FIELDS = ['duration', 'numOfTravelers', 'budget', 'pace', 'transportMode', 'arrivalPoint', 'departurePoint'];

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
    READY: 'ready'
};

// Conversation stages for the Itinerary page's post-generation refinement
// chatbot (POST /trip/refine, below) — a separate, simpler stage machine
// from STAGES above, since this conversation starts fresh once an itinerary
// already exists rather than building one up field by field.
var REFINE_STAGES = { CONFIRM: 'confirm', EDITING: 'editing', PICK_ACCOMMODATION: 'pick_accommodation', DONE: 'done' };

var OTHER_PREF_QUESTIONS = {
    duration: "How many days are you planning to travel?",
    numOfTravelers: "How many people will be traveling?",
    budget: "What's your budget style — budget, mid-range, or luxury?",
    pace: "What pace are you after — relaxed, standard, or packed?",
    transportMode: "How will you mostly be getting around — walking, public transit, taxi, or driving?",
    arrivalPoint: "Where will you be arriving into the destination from (airport, train station, etc.)?",
    departurePoint: "And where will you be departing from at the end of the trip?"
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
// stage machine keeps moving even without a working key/connection. Shared
// by the accommodation confirm flow (which shows every candidate for the
// traveler to pick from) and resolvePlacePoint below (which just takes the
// top match, no confirm step).
function lookupPlaceCandidates(query, city) {
    return amapPlaces.searchPlaces(query, city)
        .then(function (candidates) {
            return candidates.length ? candidates : [fallbackCandidate(query)];
        })
        .catch(function (err) {
            console.error('Place lookup failed:', err.message);
            return [fallbackCandidate(query)];
        });
}

function fallbackCandidate(query) {
    return { Name: query.trim(), Address: 'Address not verified — lookup unavailable', Latitude: null, Longitude: null };
}

// Resolves a freeform place name (e.g. an NLU-extracted arrivalPoint/
// departurePoint) to a single best-match real-world point, with no
// traveler-facing confirm step — lower stakes than picking a hotel to stay
// at, this is just for anchoring the itinerary's route and plotting it on
// the map, so the top Amap match (or the graceful unverified fallback) is
// good enough.
function resolvePlacePoint(name, city) {
    return lookupPlaceCandidates(name, city).then(function (candidates) {
        return candidates[0];
    });
}

// True when a departurePoint answer is meant to echo the arrival point
// rather than name a distinct place — either the LLM already substituted
// the arrival point's exact name per buildOtherPrefsContext's instruction
// below, or the traveler's raw text is a short referential
// phrase ("same", "same airport", "same place") that never named anything
// concrete for Amap to search on. Guards the resolvePlacePointFields
// short-circuit below (see CLAUDE.md Bugs: "same airport" fuzzy-matched to
// an unrelated restaurant instead of being recognized as the arrival point).
function isSamePlaceAnswer(departureText, arrivalName) {
    var normalized = departureText.trim().toLowerCase();
    if (arrivalName && normalized === arrivalName.trim().toLowerCase()) return true;
    return /^(the )?same( (place|airport|station|spot|one|point))?$/.test(normalized);
}

// nluExtraction.extractOtherPrefs returns arrivalPoint/departurePoint (if
// present in the message) as raw place-name strings — this resolves any
// freshly-extracted ones to a real point in place, in parallel, before the
// OTHER_PREFS stage decides whether it's done asking questions. Fields the
// traveler didn't just mention are left untouched (undefined, same as any
// other unanswered OTHER_PREF_FIELDS entry).
//
// departurePoint gets one extra check first: a referential answer meaning
// "same as arrival" is resolved by reusing the already-resolved
// arrivalPoint object directly rather than re-running it through Amap's
// place-text-search, which has no way to know "same airport" refers back to
// a place already named earlier in the conversation and can fuzzy-match it
// to an unrelated real place instead (see CLAUDE.md Bugs).
function resolvePlacePointFields(otherPrefFields, destination, existingArrivalPoint) {
    var resolutions = ['arrivalPoint', 'departurePoint']
        .filter(function (field) { return typeof otherPrefFields[field] === 'string' && otherPrefFields[field].trim(); })
        .map(function (field) {
            if (field === 'departurePoint' && existingArrivalPoint && isSamePlaceAnswer(otherPrefFields[field], existingArrivalPoint.Name)) {
                otherPrefFields[field] = existingArrivalPoint;
                return Promise.resolve();
            }
            return resolvePlacePoint(otherPrefFields[field], destination).then(function (point) {
                otherPrefFields[field] = point;
            });
        });
    return Promise.all(resolutions).then(function () { return otherPrefFields; });
}

// Appends an instruction to the pending-question context so the LLM
// resolves a referential departure answer ("same airport", "same as
// arrival") to the arrival point's exact name instead of passing the literal
// word "same" through to Amap's place search. Only applies when arrival is
// already resolved and departurePoint is actually the field being asked
// about — arrival is always asked first (OTHER_PREF_FIELDS order), so
// arrivalPoint can never itself be a forward reference to departurePoint.
function buildOtherPrefsContext(pendingQuestion, tripBrief) {
    if (!pendingQuestion) return undefined;
    if (pendingQuestion.field !== 'departurePoint' || !tripBrief.arrivalPoint || !tripBrief.arrivalPoint.Name) {
        return pendingQuestion.question;
    }
    return pendingQuestion.question + ' If the traveler says they\'re departing from the same place as arrival (e.g. "same airport", "same place"), extract departurePoint as exactly "' + tripBrief.arrivalPoint.Name + '" — the arrival point already given — not the word "same".';
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

// Real suggestions via DS-Service's POST /datasourcing/sourceaccommodations.
// No longer called during intake (see CLAUDE.md's resolved accommodation-
// timing bug) — now called post-generation, from /refine's
// REFINE_STAGES.PICK_ACCOMMODATION flow (settleAccommodation() below), with
// a `{ destination, budget }`-shaped pseudo-brief built from the itinerary
// object rather than a real tripBrief — this function only ever reads those
// two fields, so it works unmodified. Falls back to a placeholder pair if
// DS-Service is unreachable or returns nothing, so the stage machine keeps
// moving either way.
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

// Sources hotel candidates near the itinerary's actual spots — not a
// city-wide search — once the traveler has confirmed they're happy with the
// generated plan (POST /refine's REFINE_STAGES.CONFIRM "no" branch).
// DS-Service's /datasourcing/sourceaccommodations still only accepts
// city+budget (no location-biasing parameter — a documented future
// enhancement on DS-Service's side), so this reuses suggestAccommodations()
// as-is and sorts the result TBS-side by distance to the spot centroid
// instead — the same over-fetch/client-side-filter precedent this codebase
// already used for spot-swap replacement sourcing (see itineraryPlanner.js's
// findReplacementSpot). A single TBS-side change, no DS-Service contract
// change, no cross-repo dependency.
function settleAccommodation(itinerary) {
    var allSpots = (itinerary.days || []).reduce(function (acc, day) {
        return acc.concat(day.Spots || []);
    }, []);
    var budget = itinerary.budget || 'mid-range'; // matches DB_Trip.js's Budget schema default
    return suggestAccommodations({ destination: itinerary.destination, budget: budget })
        .then(function (candidates) {
            var sorted = sortAccommodationsByProximity(candidates, allSpots);
            var listing = sorted.map(function (c, i) {
                return (i + 1) + '. ' + c.Name + '\n' + c.Address;
            }).join('\n\n');
            var reply = "Now let's settle your accommodation — here are some options near where you'll actually be visiting:\n\n" +
                listing +
                '\n\nWhich one would you like to go with? (you can also click a marker on the map)';
            return { reply: reply, candidates: sorted };
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
        lookupPlaceCandidates(query, tripBrief.destination)
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
            nluExtraction.extractOtherPrefs(message, "the traveler's lodging budget style (budget, mid-range, or luxury)")
                .then(function (budgetPrefs) {
                    var livingPrefFields = { livingPreference: message.trim() };
                    if (budgetPrefs.budget) livingPrefFields.budget = budgetPrefs.budget;

                    var firstOtherQuestion = nextOtherPrefQuestion(Object.assign({}, tripBrief, livingPrefFields));
                    if (firstOtherQuestion) {
                        respond(livingPrefFields, 'Got it. ' + firstOtherQuestion.question, STAGES.OTHER_PREFS);
                    } else {
                        // No hotel prompt during intake (see CLAUDE.md's
                        // resolved accommodation-timing bug) — settling
                        // accommodation happens on the Itinerary page after
                        // the traveler has actually seen the generated spots
                        // (POST /refine's REFINE_STAGES.PICK_ACCOMMODATION).
                        respond(livingPrefFields, "Don't worry — we'll generate the itinerary first, then recommend a more suitable hotel based on where you'll actually be visiting. Hit Generate Itinerary whenever you're ready!", STAGES.READY);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.OTHER_PREFS: {
            // The message being handled here is the traveler's answer to
            // whichever question nextOtherPrefQuestion asked last turn — tripBrief
            // hasn't been merged with this answer yet, so recomputing it now
            // reliably recovers that same pending field. Passed through as
            // extractOtherPrefs' context so an ambiguous answer (e.g. a bare
            // place name) lands in the field actually being asked about instead
            // of getting guessed across all seven (see CLAUDE.md Bugs).
            var pendingQuestion = nextOtherPrefQuestion(tripBrief);
            nluExtraction.extractOtherPrefs(message, buildOtherPrefsContext(pendingQuestion, tripBrief))
                .then(function (otherPrefFields) {
                    return resolvePlacePointFields(otherPrefFields, tripBrief.destination, tripBrief.arrivalPoint);
                })
                .then(function (otherPrefFields) {
                    var mergedBrief = Object.assign({}, tripBrief, otherPrefFields);
                    var otherQuestion = nextOtherPrefQuestion(mergedBrief);

                    if (otherQuestion) {
                        respond(otherPrefFields, otherQuestion.question, STAGES.OTHER_PREFS);
                    } else if (mergedBrief.accommodationChoice === 'no_place') {
                        // No hotel prompt during intake (see CLAUDE.md's
                        // resolved accommodation-timing bug) — settling
                        // accommodation happens on the Itinerary page after
                        // the traveler has actually seen the generated spots
                        // (POST /refine's REFINE_STAGES.PICK_ACCOMMODATION).
                        respond(otherPrefFields, "Don't worry — we'll generate the itinerary first, then recommend a more suitable hotel based on where you'll actually be visiting. Hit Generate Itinerary whenever you're ready!", STAGES.READY);
                    } else {
                        respond(otherPrefFields, "I've got everything I need — hit Generate Itinerary whenever you're ready!", STAGES.READY);
                    }
                })
                .catch(respondError);
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
            return arrangeIntoDays(spots, duration, tripBrief.accommodation, tripBrief.pace, tripBrief.transportMode, tripBrief.arrivalPoint, tripBrief.departurePoint)
                .then(function (days) {
                    res.json({
                        destination: tripBrief.destination,
                        days: days,
                        accommodation: tripBrief.accommodation || null,
                        arrivalPoint: tripBrief.arrivalPoint || null,
                        departurePoint: tripBrief.departurePoint || null,
                        budget: tripBrief.budget || null,
                        // Itinerary.js's map uses this to pick which AMap routing
                        // plugin (Driving/Walking/Transfer) draws each day's real
                        // navigation route — see CLAUDE.md's route-drawing item.
                        transportMode: tripBrief.transportMode || null
                    });
                });
        })
        .catch(function (err) {
            console.error('Real itinerary generation failed, falling back:', err.message);
            res.json(generateFallbackItinerary(tripBrief));
        });
});

// Targeted edits to an already-generated itinerary, from the Itinerary
// page's persistent refinement chatbot — see CLAUDE.md, "Redesign the
// Itinerary page around a persistent chatbot". Fully stateless, same
// pattern as /intake and /generate: the client resends the full itinerary
// object every turn (the same shape /generate returns) rather than this
// route addressing a saved Mongo `_id` — nothing here touches the DB, so
// DB_Trip.js's Days/Spots sub-schemas being `{ _id: false }` never comes
// into play. Persistence stays the existing separate, explicit saveTrip()
// action, which naturally picks up whatever edits happened first.
router.post('/refine', function (req, res) {
    var message = req.body.message || '';
    var itinerary = req.body.itinerary;
    var stage = req.body.refinementStage || REFINE_STAGES.CONFIRM;

    if (!itinerary || !Array.isArray(itinerary.days)) {
        return res.status(400).json({ message: 'Missing required field: itinerary' });
    }

    function respond(reply, nextStage, updatedItinerary, extra) {
        var payload = { reply: reply, stage: nextStage };
        if (updatedItinerary) payload.itinerary = updatedItinerary;
        if (extra) Object.assign(payload, extra);
        res.json(payload);
    }
    function respondError(err) {
        console.error('Trip refine error:', err);
        res.status(502).json({ message: 'Something went wrong while processing that — please try again.' });
    }

    switch (stage) {
        case REFINE_STAGES.CONFIRM: {
            nluExtraction.extractYesNo(message, 'whether the traveler wants to change anything about the generated itinerary')
                .then(function (choice) {
                    if (choice === 'yes') {
                        respond('Sure — what would you like to change? (e.g. "swap day 2\'s museum for something more outdoorsy")', REFINE_STAGES.EDITING);
                    } else if (choice === 'no') {
                        // itinerary.accommodation is falsy only on the
                        // no-place intake path (see CLAUDE.md's resolved
                        // accommodation-timing bug) — a real user-provided
                        // pick is always a truthy object here (possibly with
                        // null Lat/Lng if the Amap lookup failed, but still
                        // truthy), so this never overrides an
                        // already-booked/in-mind place.
                        if (!itinerary.accommodation) {
                            return settleAccommodation(itinerary).then(function (result) {
                                respond(result.reply, REFINE_STAGES.PICK_ACCOMMODATION, null, { accommodationCandidates: result.candidates });
                            });
                        }
                        respond('Great — enjoy your trip!', REFINE_STAGES.DONE);
                    } else {
                        respond('Just to confirm — would you like to change anything about this plan? (yes/no)', REFINE_STAGES.CONFIRM);
                    }
                })
                .catch(respondError);
            break;
        }

        case REFINE_STAGES.PICK_ACCOMMODATION: {
            // Separate from EDITING's spot-swap parsing below — this is a
            // plain pickFromList match against the candidate list just
            // presented, same mechanism (and same statelessness workaround:
            // the client must resend accommodationCandidates every turn,
            // mirroring how /trip/intake already makes the client resend
            // accommodationCandidates/accommodationSuggestions) as
            // STAGES.ACCOMMODATION_CONFIRM above.
            var candidates = req.body.accommodationCandidates || [];
            var picked = pickFromList(candidates, message);

            if (!picked) {
                respond(
                    'Which of those would you like to go with? (reply with the name or number, or click a marker on the map)',
                    REFINE_STAGES.PICK_ACCOMMODATION,
                    null,
                    { accommodationCandidates: candidates }
                );
                break;
            }

            var updatedItinerary = applyAccommodation(itinerary, Object.assign({}, picked, { Source: 'suggested' }));
            respond(
                'Great choice — ' + picked.Name + ". I've updated your itinerary's routes around it. Anything else you'd like to change?",
                REFINE_STAGES.EDITING,
                updatedItinerary
            );
            break;
        }

        case REFINE_STAGES.EDITING:
        case REFINE_STAGES.DONE: {
            // Any message once past the initial confirm — including one sent
            // after previously answering "no" — is treated as an edit
            // instruction; a traveler changing their mind later is the same
            // operation "yes" up front would have led to.
            nluExtraction.extractSpotSwap(message, 'identifying which day, which existing spot, and what kind of replacement the traveler wants for their itinerary')
                .then(function (swap) {
                    if (!swap.dayNumber) {
                        return respond('Which day is this for, and what would you like changed? (e.g. "day 2, swap the museum for something more outdoorsy")', REFINE_STAGES.EDITING);
                    }
                    return replaceSpotInDay(itinerary, swap.dayNumber, swap.targetSpotHint, swap.replacementCategory)
                        .then(function (result) {
                            if (!result.ok) {
                                return respond(result.reply, REFINE_STAGES.EDITING);
                            }
                            respond(result.reply + ' Anything else you\'d like to change?', REFINE_STAGES.EDITING, result.itinerary);
                        });
                })
                .catch(respondError);
            break;
        }

        default:
            respond('Want to change anything about this plan? (yes/no)', REFINE_STAGES.CONFIRM);
    }
});

// Real navigation route for one leg of the Itinerary map (a pair of
// consecutive stops in a day's Route array) — see Itinerary.js's
// updateMarkers(), which calls this once per leg rather than sending the
// whole day at once, matching the per-leg shape Services/amapRouting.js's
// underlying Amap REST calls need anyway. Unauthenticated, same as
// /intake, /generate, /refine — the Itinerary page works without login.
router.post('/route', function (req, res) {
    var origin = req.body.origin;
    var destination = req.body.destination;
    if (!Array.isArray(origin) || !Array.isArray(destination)) {
        return res.status(400).json({ message: 'Missing required field: origin/destination ([lng, lat])' });
    }

    amapRouting.getRoutePath(origin, destination, req.body.transportMode, req.body.city)
        .then(function (path) { res.json({ path: path || null }); })
        .catch(function () { res.json({ path: null }); });
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
        TransportMode: body.transportMode,
        Preferences: body.preferences,
        Accommodation: body.accommodation,
        ArrivalPoint: body.arrivalPoint,
        DeparturePoint: body.departurePoint,
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
