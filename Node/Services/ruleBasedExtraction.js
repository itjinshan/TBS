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

    // "standard"/"balanced"/"normal" alone are too generic to trust as a bare
    // match (unlike "luxury" or "packed"), so only count them alongside the
    // word "pace" itself.
    if (/\b(relax(ed)?|chill|leisurely|slow.paced|easy.?going)\b/.test(text)) {
        extracted.pace = 'relaxed';
    } else if (/\b(packed|fast.paced|action.packed|jam.packed)\b/.test(text)) {
        extracted.pace = 'packed';
    } else if (/\b(standard|balanced|normal|moderate)\b.*\bpace\b|\bpace\b.*\b(standard|balanced|normal|moderate)\b/.test(text)) {
        extracted.pace = 'standard';
    }

    // Checked in this order since "taxi"/"driving" keywords are unambiguous,
    // while "public transit" needs its own multi-word phrase or a specific
    // mode name (subway/metro/bus) rather than a generic word.
    if (/\b(taxis?|cabs?|rideshare|uber|didi|grab)\b/.test(text)) {
        extracted.transportMode = 'taxi';
    } else if (/\b(driv(e|ing)|rental car|car rental|self.?drive)\b/.test(text)) {
        extracted.transportMode = 'driving';
    } else if (/\b(walk(ing)?|on foot|by foot)\b/.test(text)) {
        extracted.transportMode = 'walking';
    } else if (/\b(public transit|subway|metro|buses|bus|transit)\b/.test(text)) {
        extracted.transportMode = 'public_transit';
    }

    // Best-effort only — this is a rare-path fallback (the real /nlu/extract
    // call is the primary path, see nluExtraction.js), and unlike the closed
    // vocabularies above, a place name has no fixed set of values to match
    // against. Captures whatever follows a recognizable trigger phrase up to
    // the next clause boundary; anything that doesn't match one of these
    // phrasings just leaves the field unset, same as if nothing was said —
    // the intake stage machine re-asks rather than failing.
    var arrivalMatch = text.match(/\b(?:arriv\w*\s+(?:at|via|through|from|in)|flying into|landing at)\s+([^,.\n]+)/);
    if (arrivalMatch) extracted.arrivalPoint = arrivalMatch[1].trim();

    var departureMatch = text.match(/\b(?:depart\w*\s+(?:from|via)|leaving from|flying (?:out of|back from))\s+([^,.\n]+)/);
    if (departureMatch) extracted.departurePoint = departureMatch[1].trim();

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
