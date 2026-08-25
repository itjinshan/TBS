var axios = require('axios');
var generateAccessToken = require('../Config/jwtgenerator');

var PLACE_TEXT_SEARCH_URL = 'https://restapi.amap.com/v3/place/text';

// Same city-name mapping as amapPlaces.js — Amap's `city` param needs a
// Chinese city name (or adcode/pinyin) to scope correctly (see
// amapPlaces.js for the full rationale).
var CITY_NAME_ZH = {
    beijing: '北京',
    shanghai: '上海'
};

function toAmapCityParam(city) {
    var key = (city || '').trim().toLowerCase();
    return CITY_NAME_ZH[key] || city;
}

// How many ranked candidates to pull per query. Amap's *top* match for a
// spot name occasionally has no photos array at all even though a
// lower-ranked match for the same place does (confirmed in testing: the
// same query for a well-known spot returned a real photo on one call and
// null on the next, with the miss traced to the top candidate specifically
// lacking photos) — scanning a few candidates instead of just the first
// meaningfully raises the real-photo hit rate for the same query.
var CANDIDATE_COUNT = 5;

// Caps how many of a matched POI's photos we keep — Amap's `photos` array
// for a popular landmark can run well past what a spot card's carousel
// needs, so this is just a sane upper bound, not a quality filter.
var MAX_PHOTOS_PER_SPOT = 8;

// A single Amap place-text-search call, scanning up to CANDIDATE_COUNT
// ranked results for the first one carrying a photo and returning all of
// that POI's photo URLs (capped at MAX_PHOTOS_PER_SPOT) — not just its
// first — so a bad top pick isn't the only option a spot card can show.
// Resolves to null (never rejects) on any missing key/no-result/failure.
function searchAmapPhotos(keywords, amapCity) {
    var key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) {
        return Promise.resolve(null);
    }

    return axios.get(PLACE_TEXT_SEARCH_URL, {
        params: {
            key: key,
            keywords: keywords,
            city: amapCity || '',
            citylimit: !!amapCity,
            offset: CANDIDATE_COUNT,
            page: 1,
            extensions: 'all'
        }
    }).then(function (res) {
        var data = res.data;
        if (data.status !== '1') return null;

        var pois = data.pois || [];
        for (var i = 0; i < pois.length; i++) {
            var photos = pois[i].photos;
            if (!Array.isArray(photos) || !photos.length) continue;
            var urls = photos.map(function (p) { return p.url; }).filter(Boolean).slice(0, MAX_PHOTOS_PER_SPOT);
            if (urls.length) return urls;
        }
        return null;
    }).catch(function () {
        return null;
    });
}

// Amap's POI/keyword matching is Chinese-text-first (see CLAUDE.md, Pending
// Tasks' network-reachability item) — a transliterated name like "Jingshan
// Park" still loosely matches 景山公园, but a translated (not transliterated)
// name like "Forbidden City" has zero text overlap with 故宫 and can match
// completely unrelated POIs (confirmed in testing: it matched a film
// company and a McDonald's before any real landmark). Routed through
// DS-Service's existing POST /deepseek/plantrip — no new DS-Service surface
// needed — rather than calling an LLM directly, since TBS holds no
// OpenRouter key itself; only DS-Service does. Resolves to null (never
// rejects) so a translation failure just means no retry, not a thrown error.
function translateToChineseName(spotName) {
    if (!process.env.DS_SERVICE_BASEURL) {
        return Promise.resolve(null);
    }

    var accessToken = generateAccessToken('', 'deepseek');
    var query = 'What is the well-known Chinese name for this place: "' + spotName +
        '"? Reply with only the Chinese name, nothing else — no punctuation, no pinyin, no explanation.';

    return axios.post(process.env.DS_SERVICE_BASEURL + '/deepseek/plantrip', {
        token: accessToken,
        query: query
    }).then(function (res) {
        var content = res.data && res.data.content;
        return (typeof content === 'string' && content.trim()) || null;
    }).catch(function () {
        return null;
    });
}

// Real per-spot photo lookup via Amap's place text search — same endpoint
// as amapPlaces.js's searchPlaces(), just with extensions='all' to get each
// POI's `photos` array back. See CLAUDE.md, "Multiple photos per spot, with
// arrow-key/click navigation through them": no persistence, just the live
// photo URLs to display, so a missing key/no-result/failure all resolve to
// null (never reject) rather than surfacing an error — the caller
// (itineraryPlanner.js's assignPhotos) falls back to the placeholder cycle
// in that case, same graceful-degradation convention as amapPlaces.js.
// Tries the spot's given name first (cheap, no extra LLM call, and already
// works for transliterated names); only falls through to a Chinese-name
// translation + retry when that first search comes up empty.
function findSpotPhotos(spotName, city) {
    var amapCity = toAmapCityParam(city);

    return searchAmapPhotos(spotName, amapCity).then(function (photoUrls) {
        if (photoUrls) return photoUrls;

        return translateToChineseName(spotName).then(function (chineseName) {
            if (!chineseName) return null;
            return searchAmapPhotos(chineseName, amapCity);
        });
    });
}

// Single-photo convenience wrapper over findSpotPhotos, kept for callers
// that only ever show one image (e.g. APIs/trip.js's trip-history
// CoverPhoto) — not worth carrying a whole Photos array through those.
function findSpotPhoto(spotName, city) {
    return findSpotPhotos(spotName, city).then(function (photoUrls) {
        return (photoUrls && photoUrls[0]) || null;
    });
}

module.exports = { findSpotPhoto: findSpotPhoto, findSpotPhotos: findSpotPhotos };
