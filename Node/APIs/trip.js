var express = require('express');
var router = express.Router();
var passport = require('passport');
require('../Config/passport')(passport);
var axios = require('axios');
var Trip = require('../DB_Models/DB_Trip');
var User = require('../DB_Models/DB_User');
var { generateFallbackItinerary } = require('../Services/fallbackItinerary');
var {
    arrangeIntoDays,
    replaceSpotInDay,
    applyAccommodation,
    sortAccommodationsByProximity,
    SPOTS_PER_DAY,
    SPOT_REQUEST_BUFFER_MULTIPLIER,
    rankReplacementCandidates,
    attachPhotos,
    applyChosenReplacement
} = require('../Services/itineraryPlanner');
var spotSourcing = require('../Services/spotSourcing');
var nluExtraction = require('../Services/nluExtraction');
var amapPlaces = require('../Services/amapPlaces');
var amapRouting = require('../Services/amapRouting');
var spotPhotos = require('../Services/spotPhotos');
var generateAccessToken = require('../Config/jwtgenerator');
var { t } = require('../Utils/i18n');

var OTHER_PREF_FIELDS = ['duration', 'startDate', 'numOfTravelers', 'budget', 'pace', 'transportMode', 'arrivalPoint', 'departurePoint'];

// How many alternative spots the Itinerary page's per-spot "similar
// attractions" carousel shows under each spot card (see POST
// /trip/similar-spots below).
var SIMILAR_SPOTS_CAROUSEL_TOPN = 3;

// The pool size /trip/similar-spots requests — deliberately smaller than
// itineraryPlanner.js's REPLACEMENT_OVERFETCH_MIN_COUNT (40), which the
// chat-based single-spot swap still uses unchanged. That swap is an
// explicit, one-off traveler action, so a rare LLM top-up (DS-Service's
// sourcespots is DB-first-then-LLM-top-up) is an acceptable wait. This
// lookup instead fires automatically on every Itinerary page load — a much
// higher-frequency, lower-value trigger — so it targets a count close to
// what /trip/generate itself already just requested for this exact
// destination (duration * SPOTS_PER_DAY * SPOT_REQUEST_BUFFER_MULTIPLIER),
// which is normally already sourced into Mongo by the time this runs,
// making this a DB-only hit rather than a fresh LLM call. Confirmed in
// testing: requesting the full 40 here could force a 40-spot top-up
// generation taking minutes, for a feature that's supposed to be a cheap,
// decorative enhancement.
var SIMILAR_SPOTS_POOL_MIN_COUNT = 20;

// Upper bound on how long /trip/similar-spots waits on DS-Service's spot
// pool before giving up and responding with empty candidate lists rather
// than hanging the request indefinitely — see SIMILAR_SPOTS_POOL_MIN_COUNT
// above for why a top-up is possible (if rare) here. Deliberately NOT
// applied to spotSourcing.sourceSpots() itself (used unchanged by
// /trip/generate and the chat-based swap, both of which legitimately need
// to wait out a real sourcing/top-up call) — this is a route-local budget
// for this one secondary/decorative feature only.
var SIMILAR_SPOTS_TIMEOUT_MS = 12000;

// Conversation stages for trip intake. Accommodation is settled right after
// destination (and before the rest of the trip preferences) because it
// decides the starting location for each day of the generated itinerary —
// see CLAUDE.md, "Planned: Lodging Flow".
var STAGES = {
    DESTINATION: 'destination',
    ACCOMMODATION_CHOICE: 'accommodation_choice',
    ACCOMMODATION_BOOKED_CHECK: 'accommodation_booked_check',
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

// Maps each OTHER_PREF_FIELDS entry to its Utils/i18n.js key — the question
// text itself lives there now (alongside every other server-generated
// string), not as a literal here.
var OTHER_PREF_QUESTION_KEYS = {
    duration: 'questionDuration',
    startDate: 'questionStartDate',
    numOfTravelers: 'questionNumOfTravelers',
    budget: 'questionBudget',
    pace: 'questionPace',
    transportMode: 'questionTransportMode',
    arrivalPoint: 'questionArrivalPoint',
    departurePoint: 'questionDeparturePoint'
};

function nextOtherPrefQuestion(mergedBrief, lang) {
    var missing = OTHER_PREF_FIELDS.filter(function (field) {
        return mergedBrief[field] === undefined || mergedBrief[field] === null || mergedBrief[field] === '';
    });
    return missing.length ? { field: missing[0], question: t(lang, OTHER_PREF_QUESTION_KEYS[missing[0]]) } : null;
}

// Real place lookup via Amap (see CLAUDE.md, "Planned: Lodging Flow", action
// item #2). Falls back to a single unverified candidate — today's prior
// placeholder behavior — if the API call fails or turns up nothing, so the
// stage machine keeps moving even without a working key/connection. Shared
// by the accommodation confirm flow (which shows every candidate for the
// traveler to pick from) and resolvePlacePoint below (which just takes the
// top match, no confirm step).
function lookupPlaceCandidates(query, city, lang) {
    return amapPlaces.searchPlaces(query, city)
        .then(function (candidates) {
            return candidates.length ? candidates : [fallbackCandidate(query, lang)];
        })
        .catch(function (err) {
            console.error('Place lookup failed:', err.message);
            return [fallbackCandidate(query, lang)];
        });
}

function fallbackCandidate(query, lang) {
    return { Name: query.trim(), Address: t(lang, 'addressNotVerified'), Latitude: null, Longitude: null };
}

// Query text → the Amap POI "type" substring a matching real place should
// carry. Amap's `type` field is a semicolon-separated Chinese category path
// (e.g. "交通设施服务;机场相关;机场" for an airport) — matching against it
// directly, rather than the numeric typecode, keeps this readable without a
// lookup table of Amap's category codes. Covers the two transit-hub cases an
// arrival/departure answer actually names; anything else falls through to
// today's untyped top-match behavior.
var EXPECTED_PLACE_TYPES = [
    { namePattern: /airport|机场/i, typeMatch: /机场/ },
    { namePattern: /train station|railway station|高铁站|火车站/i, typeMatch: /火车站/ }
];

// Picks the best candidate for a resolvePlacePoint query, preferring one
// whose Amap POI type matches the kind of place the query text names over
// blindly trusting candidates[0] (Amap's own fuzzy-match ranking). See
// CLAUDE.md Bugs: a translated (not transliterated) query like "Shanghai
// Pudong Airport" has near-zero token overlap with the airport's Chinese
// name, so Amap's fuzzy match can rank a same-named hotel first instead —
// this catches that case whenever the real airport/station still shows up
// somewhere in the candidate list, even if not ranked first. Falls back to
// candidates[0] when the query doesn't name a recognizable transit-hub type,
// or none of the candidates match it (e.g. the graceful unverified fallback,
// which carries no Type at all).
function pickBestCandidate(query, candidates) {
    var expected = EXPECTED_PLACE_TYPES.find(function (entry) { return entry.namePattern.test(query); });
    if (!expected) return candidates[0];

    var match = candidates.find(function (c) { return c.Type && expected.typeMatch.test(c.Type); });
    return match || candidates[0];
}

// Resolves a freeform place name (e.g. an NLU-extracted arrivalPoint/
// departurePoint) to a single best-match real-world point, with no
// traveler-facing confirm step — lower stakes than picking a hotel to stay
// at, this is just for anchoring the itinerary's route and plotting it on
// the map, so the top type-aware Amap match (or the graceful unverified
// fallback) is good enough.
function resolvePlacePoint(name, city, lang) {
    return lookupPlaceCandidates(name, city, lang).then(function (candidates) {
        return pickBestCandidate(name, candidates);
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
function resolvePlacePointFields(otherPrefFields, destination, existingArrivalPoint, lang) {
    var resolutions = ['arrivalPoint', 'departurePoint']
        .filter(function (field) { return typeof otherPrefFields[field] === 'string' && otherPrefFields[field].trim(); })
        .map(function (field) {
            if (field === 'departurePoint' && existingArrivalPoint && isSamePlaceAnswer(otherPrefFields[field], existingArrivalPoint.Name)) {
                otherPrefFields[field] = existingArrivalPoint;
                return Promise.resolve();
            }
            return resolvePlacePoint(otherPrefFields[field], destination, lang).then(function (point) {
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

function fallbackSuggestions(tripBrief, lang) {
    var destination = tripBrief.destination || 'your destination';
    return [
        { Name: t(lang, 'suggestedStay', 1, destination), Address: t(lang, 'addressPending'), Latitude: null, Longitude: null },
        { Name: t(lang, 'suggestedStay', 2, destination), Address: t(lang, 'addressPending'), Latitude: null, Longitude: null }
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
function suggestAccommodations(tripBrief, lang) {
    var accessToken = generateAccessToken('', 'deepseek');
    return axios.post(process.env.DS_SERVICE_BASEURL + '/datasourcing/sourceaccommodations', {
        token: accessToken,
        ds: 'deepseek',
        city: tripBrief.destination,
        budget: tripBrief.budget
    }).then(function (res) {
        var accommodations = res.data.accommodations || [];
        if (!accommodations.length) {
            return fallbackSuggestions(tripBrief, lang);
        }
        return accommodations.map(function (a) {
            return { Name: a.Name, Address: a.Address, Latitude: a.Latitude, Longitude: a.Longitude };
        });
    }).catch(function (err) {
        console.error('Accommodation suggestion lookup failed:', err.message);
        return fallbackSuggestions(tripBrief, lang);
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
// findReplacementSpots). A single TBS-side change, no DS-Service contract
// change, no cross-repo dependency.
function settleAccommodation(itinerary, lang) {
    var allSpots = (itinerary.days || []).reduce(function (acc, day) {
        return acc.concat(day.Spots || []);
    }, []);
    var budget = itinerary.budget || 'mid-range'; // matches DB_Trip.js's Budget schema default
    return suggestAccommodations({ destination: itinerary.destination, budget: budget }, lang)
        .then(function (candidates) {
            var sorted = sortAccommodationsByProximity(candidates, allSpots);
            var listing = sorted.map(function (c, i) {
                return (i + 1) + '. ' + c.Name + '\n' + c.Address;
            }).join('\n\n');
            var reply = t(lang, 'accommodationSettleIntro') + '\n\n' +
                listing +
                '\n\n' + t(lang, 'accommodationSettleOutro');
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
        res.status(502).json({ message: t(req.lang, 'intakeGenericError') });
    }

    // Runs an Amap lookup and presents every match for the user to confirm —
    // stays in ACCOMMODATION_CONFIRM either way; a second message either picks
    // one of these candidates or (if nothing matches) triggers a fresh search.
    //
    // When the traveler said this place is only "in mind" (not booked —
    // ACCOMMODATION_BOOKED_CHECK below), also pulls in the same kind of
    // budget-tier listing suggestAccommodations() produces for the no-place
    // path, so they can compare nearby alternatives instead of only ever
    // getting a confirm-or-search-again loop on the one name they typed. The
    // alternatives are fetched once per intake (DS-Service's sourceaccommodations
    // is LLM-backed) and carried forward via tripBrief on retries rather than
    // re-fetched on every search attempt.
    function searchAndPresent(query) {
        var wantsAlternatives = tripBrief.accommodationChoice === 'has_place_in_mind';
        var alreadyFetched = tripBrief.accommodationAlternativesFetched;
        var alternativesPromise = wantsAlternatives && !alreadyFetched
            ? suggestAccommodations({ destination: tripBrief.destination, budget: tripBrief.budget || 'mid-range' }, req.lang)
            : Promise.resolve(tripBrief.accommodationAlternatives || []);

        Promise.all([lookupPlaceCandidates(query, tripBrief.destination, req.lang), alternativesPromise])
            .then(function (results) {
                var matches = results[0];
                var alternatives = results[1];
                var matchedNames = matches.map(function (c) { return c.Name.toLowerCase(); });
                var newAlternatives = alternatives.filter(function (a) { return !matchedNames.includes(a.Name.toLowerCase()); });
                var candidates = matches.concat(newAlternatives);

                var listing = candidates.map(function (c, i) {
                    return (i + 1) + '. ' + c.Name + '\n' + c.Address;
                }).join('\n\n');
                var intro = matches.length > 1
                    ? t(req.lang, 'accommodationListingSimilar')
                    : t(req.lang, 'accommodationListingConfirm', query.trim());
                if (wantsAlternatives && newAlternatives.length) {
                    intro += '\n\n' + t(req.lang, 'accommodationListingAlternativesIntro');
                }
                var reply = intro + '\n\n' + listing + '\n\n' + t(req.lang, 'accommodationListingOutro');
                respond({
                    accommodationCandidates: candidates,
                    accommodationAlternatives: alternatives,
                    accommodationAlternativesFetched: wantsAlternatives ? true : alreadyFetched
                }, reply, STAGES.ACCOMMODATION_CONFIRM);
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
                            t(req.lang, 'destinationConfirmed', destination),
                            STAGES.ACCOMMODATION_CHOICE
                        );
                    } else {
                        respond({}, t(req.lang, 'whereHeaded'), STAGES.DESTINATION);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.ACCOMMODATION_CHOICE: {
            nluExtraction.extractYesNo(message, 'whether the traveler already has a place to stay booked or in mind')
                .then(function (choice) {
                    if (choice === 'yes') {
                        // Don't assume "yes" means booked — a place that's
                        // only in mind gets similar-alternatives offered once
                        // named (see ACCOMMODATION_BOOKED_CHECK below).
                        respond({}, t(req.lang, 'placeBookedAsk'), STAGES.ACCOMMODATION_BOOKED_CHECK);
                    } else if (choice === 'no') {
                        respond(
                            { accommodationChoice: 'no_place' },
                            t(req.lang, 'budgetLivingPrefAsk'),
                            STAGES.BUDGET_LIVING_PREF
                        );
                    } else {
                        respond({}, t(req.lang, 'confirmHavePlace'), STAGES.ACCOMMODATION_CHOICE);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.ACCOMMODATION_BOOKED_CHECK: {
            nluExtraction.extractYesNo(message, 'whether the traveler has already booked the place they have in mind, as opposed to just having it in mind without booking it')
                .then(function (booked) {
                    if (booked === 'yes') {
                        respond(
                            { accommodationChoice: 'has_place_booked' },
                            t(req.lang, 'placeNameAsk'),
                            STAGES.ACCOMMODATION_CONFIRM
                        );
                    } else if (booked === 'no') {
                        respond(
                            { accommodationChoice: 'has_place_in_mind' },
                            t(req.lang, 'placeNameAsk'),
                            STAGES.ACCOMMODATION_CONFIRM
                        );
                    } else {
                        respond({}, t(req.lang, 'confirmBookedChoice'), STAGES.ACCOMMODATION_BOOKED_CHECK);
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
                var afterConfirm = nextOtherPrefQuestion(Object.assign({}, tripBrief, extractedFields), req.lang);
                if (afterConfirm) {
                    respond(extractedFields, t(req.lang, 'gotItThenQuestion', picked.Name, afterConfirm.question), STAGES.OTHER_PREFS);
                } else {
                    respond(extractedFields, t(req.lang, 'gotItReadyNoQuestions', picked.Name), STAGES.READY);
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

                    var firstOtherQuestion = nextOtherPrefQuestion(Object.assign({}, tripBrief, livingPrefFields), req.lang);
                    if (firstOtherQuestion) {
                        respond(livingPrefFields, t(req.lang, 'gotItQuestion', firstOtherQuestion.question), STAGES.OTHER_PREFS);
                    } else {
                        // No hotel prompt during intake (see CLAUDE.md's
                        // resolved accommodation-timing bug) — settling
                        // accommodation happens on the Itinerary page after
                        // the traveler has actually seen the generated spots
                        // (POST /refine's REFINE_STAGES.PICK_ACCOMMODATION).
                        respond(livingPrefFields, t(req.lang, 'willGenerateFirst'), STAGES.READY);
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
            var pendingQuestion = nextOtherPrefQuestion(tripBrief, req.lang);
            nluExtraction.extractOtherPrefs(message, buildOtherPrefsContext(pendingQuestion, tripBrief))
                .then(function (otherPrefFields) {
                    return resolvePlacePointFields(otherPrefFields, tripBrief.destination, tripBrief.arrivalPoint, req.lang);
                })
                .then(function (otherPrefFields) {
                    var mergedBrief = Object.assign({}, tripBrief, otherPrefFields);
                    var otherQuestion = nextOtherPrefQuestion(mergedBrief, req.lang);

                    if (otherQuestion) {
                        respond(otherPrefFields, otherQuestion.question, STAGES.OTHER_PREFS);
                    } else if (mergedBrief.accommodationChoice === 'no_place') {
                        // No hotel prompt during intake (see CLAUDE.md's
                        // resolved accommodation-timing bug) — settling
                        // accommodation happens on the Itinerary page after
                        // the traveler has actually seen the generated spots
                        // (POST /refine's REFINE_STAGES.PICK_ACCOMMODATION).
                        respond(otherPrefFields, t(req.lang, 'willGenerateFirst'), STAGES.READY);
                    } else {
                        respond(otherPrefFields, t(req.lang, 'readyToGenerate'), STAGES.READY);
                    }
                })
                .catch(respondError);
            break;
        }

        case STAGES.READY:
        default: {
            nluExtraction.extractOtherPrefs(message)
                .then(function (otherPrefFields) {
                    respond(otherPrefFields, t(req.lang, 'readyToGenerate'), STAGES.READY);
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
        return res.status(400).json({ message: t(req.lang, 'missingDestination') });
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
        return res.status(400).json({ message: t(req.lang, 'missingItinerary') });
    }

    function respond(reply, nextStage, updatedItinerary, extra) {
        var payload = { reply: reply, stage: nextStage };
        if (updatedItinerary) payload.itinerary = updatedItinerary;
        if (extra) Object.assign(payload, extra);
        res.json(payload);
    }
    function respondError(err) {
        console.error('Trip refine error:', err);
        res.status(502).json({ message: t(req.lang, 'refineGenericError') });
    }

    // The Itinerary page's per-spot "similar attractions" carousel (POST
    // /trip/similar-spots below) already knows exactly which candidate the
    // traveler clicked — no NLU guessing needed, so it sends the chosen
    // replacement directly instead of a chat `message`. Checked ahead of the
    // stage switch below, not inside it, since this is a standalone UI
    // action available regardless of where the chat conversation currently
    // sits (e.g. before the traveler has ever answered the initial "want to
    // change anything?" prompt) — same itinerary-mutation path as the
    // chat-driven swap (applyChosenReplacement shares replaceSpotInDay's
    // splice/route-recompute step), just a second, more discoverable entry
    // point onto it. Always leaves the conversation in EDITING afterward so
    // a follow-up chat message continues naturally from there.
    if (req.body.directSwap) {
        var directSwap = req.body.directSwap;
        var directResult = applyChosenReplacement(itinerary, directSwap.dayNumber, directSwap.targetSpotName, directSwap.replacement, req.lang);
        if (!directResult.ok) {
            return respond(directResult.reply, REFINE_STAGES.EDITING);
        }
        return respond(directResult.reply + t(req.lang, 'refineAnythingElseSuffix'), REFINE_STAGES.EDITING, directResult.itinerary);
    }

    switch (stage) {
        case REFINE_STAGES.CONFIRM: {
            nluExtraction.extractYesNo(message, 'whether the traveler wants to change anything about the generated itinerary')
                .then(function (choice) {
                    if (choice === 'yes') {
                        respond(t(req.lang, 'refineWhatToChange'), REFINE_STAGES.EDITING);
                    } else if (choice === 'no') {
                        // itinerary.accommodation is falsy only on the
                        // no-place intake path (see CLAUDE.md's resolved
                        // accommodation-timing bug) — a real user-provided
                        // pick is always a truthy object here (possibly with
                        // null Lat/Lng if the Amap lookup failed, but still
                        // truthy), so this never overrides an
                        // already-booked/in-mind place.
                        if (!itinerary.accommodation) {
                            return settleAccommodation(itinerary, req.lang).then(function (result) {
                                respond(result.reply, REFINE_STAGES.PICK_ACCOMMODATION, null, { accommodationCandidates: result.candidates });
                            });
                        }
                        respond(t(req.lang, 'refineEnjoyTrip'), REFINE_STAGES.DONE);
                    } else {
                        respond(t(req.lang, 'refineConfirmChangeAnything'), REFINE_STAGES.CONFIRM);
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
                    t(req.lang, 'refinePickAccommodation'),
                    REFINE_STAGES.PICK_ACCOMMODATION,
                    null,
                    { accommodationCandidates: candidates }
                );
                break;
            }

            var updatedItinerary = applyAccommodation(itinerary, Object.assign({}, picked, { Source: 'suggested' }));
            respond(
                t(req.lang, 'refineGreatChoice', picked.Name),
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
                        return respond(t(req.lang, 'refineWhichDayWhatChange'), REFINE_STAGES.EDITING);
                    }
                    return replaceSpotInDay(itinerary, swap.dayNumber, swap.targetSpotHint, swap.replacementCategory, req.lang)
                        .then(function (result) {
                            if (!result.ok) {
                                return respond(result.reply, REFINE_STAGES.EDITING);
                            }
                            respond(result.reply + t(req.lang, 'refineAnythingElseSuffix'), REFINE_STAGES.EDITING, result.itinerary);
                        });
                })
                .catch(respondError);
            break;
        }

        default:
            respond(t(req.lang, 'refineWantToChangeAnything'), REFINE_STAGES.CONFIRM);
    }
});

// Powers the Itinerary page's per-spot "similar attractions" carousel: for
// every spot currently in the itinerary, returns up to
// SIMILAR_SPOTS_CAROUSEL_TOPN ranked alternatives from the same city's
// already-sourced spot pool (see itineraryPlanner.js's
// rankReplacementCandidates). Fetches that pool exactly once — not once per
// spot — since every spot in a trip shares the same destination; ranking
// itself is then an in-memory, no-network step per spot. Unauthenticated,
// same as /intake, /generate, /refine — the Itinerary page works without
// login.
router.post('/similar-spots', function (req, res) {
    var itinerary = req.body.itinerary;
    if (!itinerary || !Array.isArray(itinerary.days)) {
        return res.status(400).json({ message: t(req.lang, 'missingItinerary') });
    }

    var allSpots = itinerary.days.reduce(function (acc, day) {
        return acc.concat(day.Spots || []);
    }, []);
    var usedNames = new Set(allSpots.map(function (s) { return s.Name.toLowerCase(); }));

    // Races the pool fetch against SIMILAR_SPOTS_TIMEOUT_MS — if DS-Service
    // needs an LLM top-up (slow) rather than a DB-only hit (fast, the
    // common case right after /trip/generate sourced this same
    // destination), this gives up and renders with no candidates rather
    // than leaving the Itinerary page's carousel row hanging indefinitely.
    var timeoutPool = new Promise(function (resolve) {
        setTimeout(function () { resolve([]); }, SIMILAR_SPOTS_TIMEOUT_MS);
    });

    Promise.race([spotSourcing.sourceSpots(itinerary.destination, SIMILAR_SPOTS_POOL_MIN_COUNT), timeoutPool])
        .then(function (pool) {
            var rankedBySpot = allSpots.map(function (spot) {
                return rankReplacementCandidates(pool, usedNames, spot, SIMILAR_SPOTS_CAROUSEL_TOPN);
            });

            // The same candidate frequently comes up for more than one spot
            // in the itinerary (same city pool) — photo lookups are deduped
            // by name here rather than fetched once per occurrence.
            var byName = new Map();
            rankedBySpot.forEach(function (candidates) {
                candidates.forEach(function (candidate) { byName.set(candidate.Name, candidate); });
            });

            return attachPhotos(Array.from(byName.values())).then(function (withPhotos) {
                var photosByName = new Map(withPhotos.map(function (spot) { return [spot.Name, spot]; }));
                var candidatesBySpot = {};
                allSpots.forEach(function (spot, i) {
                    candidatesBySpot[spot.Name] = rankedBySpot[i].map(function (candidate) {
                        return photosByName.get(candidate.Name) || candidate;
                    });
                });
                res.json({ candidatesBySpot: candidatesBySpot });
            });
        })
        .catch(function (err) {
            console.error('Similar-spots lookup failed:', err);
            res.status(502).json({ message: t(req.lang, 'similarSpotsError') });
        });
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
        return res.status(400).json({ message: t(req.lang, 'missingOriginDestination') });
    }

    amapRouting.getRoutePath(origin, destination, req.body.transportMode, req.body.city)
        .then(function (path) { res.json({ path: path || null }); })
        .catch(function () { res.json({ path: null }); });
});

// Creates a trip on first save, then is also the auto-save target for every
// later edit made on the Itinerary page (see tripAction.js's
// autoSaveTrip()) — the frontend POSTs here once (no `_id` yet) and PUTs to
// /:id (below) on every subsequent change, so there's no manual "Save Trip"
// button/action anymore.
router.post('/', passport.authenticate('jwt', { session: false }), function (req, res) {
    var body = req.body;

    spotPhotos.findSpotPhoto(body.destination, body.destination).then(function (coverPhoto) {
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
            Days: body.days,
            StartDate: body.startDate,
            CoverPhoto: coverPhoto
        });

        return trip.save().then(function (saved) {
            req.user.TripHistory.push({ TripID: saved._id });
            return req.user.save().then(function () { res.json(saved); });
        });
    }).catch(function (err) {
        console.log(err);
        res.status(400).json({ message: t(req.lang, 'failedToSaveTrip') });
    });
});

// Updates an already-saved trip in place — the auto-save target for every
// edit after the initial POST above (refine-chat swaps, accommodation
// picks, ...). Ownership-checked the same way GET /:id is. Doesn't
// re-derive CoverPhoto — the destination a trip was created for doesn't
// change via these edits, so the original lookup still applies.
router.put('/:id', passport.authenticate('jwt', { session: false }), function (req, res) {
    var body = req.body;
    Trip.findOneAndUpdate(
        { _id: req.params.id, Owner: req.user.id },
        {
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
            Days: body.days,
            StartDate: body.startDate
        },
        { new: true }
    )
        .then(function (trip) {
            if (!trip) return res.status(404).json({ message: t(req.lang, 'tripNotFound') });
            res.json(trip);
        })
        .catch(function (err) {
            console.log(err);
            res.status(400).json({ message: t(req.lang, 'failedToUpdateTrip') });
        });
});

// List the logged-in traveler's saved trips, split into past/upcoming —
// backs the profile page's trip history (see TBS's CLAUDE.md's "Pending
// Tasks", "Build a profile management page"). Registered before GET /:id so
// the literal path "mine" isn't swallowed by that route's :id param.
// Deliberately lean (no Days/Spots) — the profile page only needs enough to
// render a trip card; the full document is fetched on demand via GET /:id
// when a traveler clicks into one.
router.get('/mine', passport.authenticate('jwt', { session: false }), function (req, res) {
    User.findById(req.user.id)
        .populate('TripHistory.TripID', 'Destination NumOfTravelers Budget StartDate CreatedAt Duration CoverPhoto')
        .then(function (user) {
            var now = new Date();
            var past = [];
            var upcoming = [];
            user.TripHistory.forEach(function (entry) {
                var trip = entry.TripID;
                if (!trip) return; // trip was deleted after being added to history
                var summary = {
                    id: trip._id,
                    destination: trip.Destination,
                    numOfTravelers: trip.NumOfTravelers,
                    budget: trip.Budget,
                    startDate: trip.StartDate,
                    createdAt: trip.CreatedAt,
                    duration: trip.Duration,
                    coverPhoto: trip.CoverPhoto
                };
                // No StartDate yet (asked during intake, but optional) reads
                // as "not yet happened" rather than a bucket of its own.
                if (trip.StartDate && trip.StartDate < now) {
                    past.push(summary);
                } else {
                    upcoming.push(summary);
                }
            });
            res.json({ past: past, upcoming: upcoming });
        })
        .catch(function (err) {
            console.log(err);
            res.status(400).json({ message: t(req.lang, 'failedToLoadHistory') });
        });
});

router.get('/:id', passport.authenticate('jwt', { session: false }), function (req, res) {
    Trip.findOne({ _id: req.params.id, Owner: req.user.id })
        .then(function (trip) {
            if (!trip) return res.status(404).json({ message: t(req.lang, 'tripNotFound') });
            res.json(trip);
        })
        .catch(function (err) {
            console.log(err);
            res.status(400).json({ message: t(req.lang, 'invalidTripId') });
        });
});

module.exports = router;
