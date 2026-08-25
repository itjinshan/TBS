var axios = require('axios');

var PLACE_TEXT_SEARCH_URL = 'https://restapi.amap.com/v3/place/text';

// Amap's `city` param needs a Chinese city name (or adcode/pinyin) to scope
// correctly — the English destination names trip.js extracts (e.g. "Beijing")
// silently fail to restrict the search. Amap's coverage/keyword-matching is
// mainland-China-first anyway (see CLAUDE.md action item #7), so this only
// covers the Chinese destinations it's actually meant to serve today.
var CITY_NAME_ZH = {
    beijing: '北京',
    shanghai: '上海'
};

function toAmapCityParam(city) {
    var key = (city || '').trim().toLowerCase();
    return CITY_NAME_ZH[key] || city;
}

// Real place lookup for the "I have a place" lodging path (see CLAUDE.md,
// "Planned: Lodging Flow", action item #2). Requires AMAP_WEB_SERVICE_KEY —
// a Web service API key from https://console.amap.com, NOT the JS API key
// useAmap.js loads client-side for map rendering.
function searchPlaces(query, city) {
    var key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) {
        return Promise.reject(new Error('AMAP_WEB_SERVICE_KEY is not configured'));
    }

    var amapCity = toAmapCityParam(city);

    return axios.get(PLACE_TEXT_SEARCH_URL, {
        params: {
            key: key,
            keywords: query,
            city: amapCity || '',
            citylimit: !!amapCity,
            offset: 5,
            page: 1,
            extensions: 'base'
        }
    }).then(function (res) {
        var data = res.data;
        if (data.status !== '1') {
            throw new Error('Amap place search failed: ' + (data.info || data.infocode));
        }

        return (data.pois || [])
            .filter(function (poi) { return poi.location; })
            .map(function (poi) {
                var parts = poi.location.split(',');
                var address = Array.isArray(poi.address) ? poi.address.join(', ') : poi.address;
                return {
                    Name: poi.name,
                    Address: address || poi.name,
                    Latitude: parseFloat(parts[1]),
                    Longitude: parseFloat(parts[0]),
                    // Amap's semicolon-separated Chinese category path (e.g.
                    // "交通设施服务;机场相关;机场") — not persisted on the Trip
                    // document (PlacePointSchema has no Type field), only used
                    // transiently by trip.js's resolvePlacePoint to tell an
                    // airport/station candidate apart from a same-named hotel.
                    Type: poi.type
                };
            });
    });
}

module.exports = { searchPlaces: searchPlaces, toAmapCityParam: toAmapCityParam };
