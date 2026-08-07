var axios = require('axios');

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

// Real per-spot photo lookup via Amap's place text search — same endpoint
// as amapPlaces.js's searchPlaces(), just with extensions='all' to get each
// POI's `photos` array back. See CLAUDE.md, "Fetch real per-spot photos
// instead of a fixed 4-image placeholder cycle": no persistence, just the
// live photo URL to display, so a missing key/no-result/failure all
// resolve to null (never reject) rather than surfacing an error — the
// caller (itineraryPlanner.js's assignPhotos) falls back to the placeholder
// cycle in that case, same graceful-degradation convention as amapPlaces.js.
function findSpotPhoto(spotName, city) {
    var key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) {
        return Promise.resolve(null);
    }

    var amapCity = toAmapCityParam(city);

    return axios.get(PLACE_TEXT_SEARCH_URL, {
        params: {
            key: key,
            keywords: spotName,
            city: amapCity || '',
            citylimit: !!amapCity,
            offset: 1,
            page: 1,
            extensions: 'all'
        }
    }).then(function (res) {
        var data = res.data;
        if (data.status !== '1') return null;

        var poi = (data.pois || [])[0];
        var photos = poi && poi.photos;
        var firstPhoto = Array.isArray(photos) ? photos[0] : null;
        return (firstPhoto && firstPhoto.url) || null;
    }).catch(function () {
        return null;
    });
}

module.exports = { findSpotPhoto: findSpotPhoto };
