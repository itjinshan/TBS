var axios = require('axios');

var PLACE_TEXT_SEARCH_URL = 'https://restapi.amap.com/v3/place/text';

// Real place lookup for the "I have a place" lodging path (see CLAUDE.md,
// "Planned: Lodging Flow", action item #2). Requires AMAP_WEB_SERVICE_KEY —
// a Web service API key from https://console.amap.com, NOT the JS API key
// useAmap.js loads client-side for map rendering.
function searchPlaces(query, city) {
    var key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) {
        return Promise.reject(new Error('AMAP_WEB_SERVICE_KEY is not configured'));
    }

    return axios.get(PLACE_TEXT_SEARCH_URL, {
        params: {
            key: key,
            keywords: query,
            city: city || '',
            citylimit: !!city,
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
                    Longitude: parseFloat(parts[0])
                };
            });
    });
}

module.exports = { searchPlaces: searchPlaces };
