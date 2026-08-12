var axios = require('axios');
var generateAccessToken = require('../Config/jwtgenerator');
var ruleBasedExtraction = require('./ruleBasedExtraction');

function callExtract(message, fields, context) {
    var accessToken = generateAccessToken('', 'deepseek');
    return axios.post(process.env.DS_SERVICE_BASEURL + '/nlu/extract', {
        token: accessToken,
        ds: 'deepseek',
        message: message,
        fields: fields,
        context: context
    }).then(function (res) {
        return res.data.extracted || {};
    });
}

function isPresent(value) {
    return value !== null && value !== undefined;
}

// Real field extraction via DS-Service's POST /nlu/extract (see CLAUDE.md,
// "Planned: Real Trip-Generation Data", action item #4). Each function below
// falls back internally to the matching Services/ruleBasedExtraction.js
// function on any failure (network error, timeout, non-2xx, malformed JSON)
// — always resolves, never rejects, so APIs/trip.js's call sites don't need
// their own try/catch. Mirrors the existing lookupAccommodationCandidates/
// suggestAccommodations fallback pattern already in trip.js.
//
// Unlike the old synchronous regex functions, these return Promises.

function extractDestination(message) {
    return callExtract(message, ['destination']).then(function (extracted) {
        return isPresent(extracted.destination) ? extracted.destination : undefined;
    }).catch(function (err) {
        console.error('NLU destination extraction failed, falling back to regex:', err.message);
        return ruleBasedExtraction.extractDestination(message);
    });
}

// `context` disambiguates which field a free-text answer is meant to fill —
// same mechanism as extractYesNo below. Without it, an ambiguous answer
// (e.g. a bare place name mid-OTHER_PREFS) gets extracted blind across all
// seven fields and can land in the wrong one (see CLAUDE.md Bugs: a
// departurePoint answer getting misfiled as a fresh arrivalPoint). Optional
// and defaults to undefined so callers with no single pending field (e.g.
// the initial freeform trip description) keep today's blind-extraction
// behavior.
function extractOtherPrefs(message, context) {
    return callExtract(message, ['duration', 'numOfTravelers', 'budget', 'pace', 'transportMode', 'arrivalPoint', 'departurePoint'], context).then(function (extracted) {
        var result = {};
        if (isPresent(extracted.duration)) result.duration = extracted.duration;
        if (isPresent(extracted.numOfTravelers)) result.numOfTravelers = extracted.numOfTravelers;
        if (isPresent(extracted.budget)) result.budget = extracted.budget;
        if (isPresent(extracted.pace)) result.pace = extracted.pace;
        if (isPresent(extracted.transportMode)) result.transportMode = extracted.transportMode;
        if (isPresent(extracted.arrivalPoint)) result.arrivalPoint = extracted.arrivalPoint;
        if (isPresent(extracted.departurePoint)) result.departurePoint = extracted.departurePoint;
        return result;
    }).catch(function (err) {
        console.error('NLU preference extraction failed, falling back to regex:', err.message);
        return ruleBasedExtraction.extractOtherPrefs(message);
    });
}

// `context` disambiguates what's being confirmed — unlike the old regex,
// the LLM has no other way to know what a bare "yes"/"no" is answering.
function extractYesNo(message, context) {
    return callExtract(message, ['yesno'], context).then(function (extracted) {
        return isPresent(extracted.yesno) ? extracted.yesno : undefined;
    }).catch(function (err) {
        console.error('NLU yes/no extraction failed, falling back to regex:', err.message);
        return ruleBasedExtraction.extractYesNo(message);
    });
}

// Parses a free-text itinerary-edit instruction (e.g. "swap day 2's museum
// for something more outdoorsy") into which day, which existing spot
// (a name/description hint, not necessarily an exact match), and what
// category of replacement the traveler wants. No rule-based fallback here —
// there's no regex equivalent for this shape of extraction — a DS-Service
// failure just resolves to {}, letting the caller re-ask instead of guessing.
function extractSpotSwap(message, context) {
    return callExtract(message, ['dayNumber', 'targetSpotHint', 'replacementCategory'], context).then(function (extracted) {
        var result = {};
        if (isPresent(extracted.dayNumber)) result.dayNumber = Number(extracted.dayNumber);
        if (isPresent(extracted.targetSpotHint)) result.targetSpotHint = extracted.targetSpotHint;
        if (isPresent(extracted.replacementCategory)) result.replacementCategory = extracted.replacementCategory;
        return result;
    }).catch(function (err) {
        console.error('NLU spot-swap extraction failed:', err.message);
        return {};
    });
}

module.exports = { extractDestination, extractOtherPrefs, extractYesNo, extractSpotSwap };
