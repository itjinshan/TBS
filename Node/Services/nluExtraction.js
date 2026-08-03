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

function extractOtherPrefs(message) {
    return callExtract(message, ['duration', 'numOfTravelers', 'budget']).then(function (extracted) {
        var result = {};
        if (isPresent(extracted.duration)) result.duration = extracted.duration;
        if (isPresent(extracted.numOfTravelers)) result.numOfTravelers = extracted.numOfTravelers;
        if (isPresent(extracted.budget)) result.budget = extracted.budget;
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

module.exports = { extractDestination, extractOtherPrefs, extractYesNo };
