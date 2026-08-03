// Rule-based slot extraction — the original placeholder for real language
// understanding, moved here verbatim from APIs/trip.js. No longer the
// primary path: Services/nluExtraction.js calls DS-Service's real /nlu/extract
// endpoint first and falls back to these functions only if that call fails
// (network error, timeout, non-2xx, malformed JSON). See CLAUDE.md, "Planned:
// Real Trip-Generation Data", action item #4.

var KNOWN_DESTINATIONS = [
    'bali', 'paris', 'tokyo', 'new york', 'santorini', 'sydney', 'beijing', 'shanghai'
];

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

module.exports = { extractDestination, extractOtherPrefs, extractYesNo };
