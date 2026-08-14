var axios = require('axios');
var toAmapCityParam = require('./amapPlaces').toAmapCityParam;

// Real turn-by-turn route paths for the Itinerary map (see
// react-frontend/src/components/itinerary/Itinerary.js's updateMarkers()) —
// one REST call per leg (a pair of consecutive Route stops), using the same
// AMAP_WEB_SERVICE_KEY Services/amapPlaces.js and Services/spotPhotos.js
// already call restapi.amap.com with. The frontend's own Amap key
// (useAmap.js) is JS-API-only and can't authorize these lookups itself —
// confirmed live, AMap's client-side Driving/Walking/Transfer JS plugins
// all failed with INVALID_USER_SCODE against it — so routing is proxied
// through here instead.
var DRIVING_URL = 'https://restapi.amap.com/v3/direction/driving';
var WALKING_URL = 'https://restapi.amap.com/v3/direction/walking';
var TRANSIT_URL = 'https://restapi.amap.com/v3/direction/transit/integrated';

// Amap's polyline fields are "lng,lat;lng,lat;..." strings, everywhere they
// appear across the driving/walking/transit response shapes below.
function parsePolyline(polyline) {
    if (!polyline) return [];
    return polyline.split(';').map(function (pair) {
        var parts = pair.split(',');
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    });
}

function toLngLatParam(point) {
    return point[0] + ',' + point[1];
}

// Driving/walking share one response shape: route.paths[0].steps[], each
// step's own polyline covering that step's stretch of road — concatenated
// in order for the full leg.
function fetchSimplePath(url, key, origin, destination) {
    return axios.get(url, {
        params: { key: key, origin: toLngLatParam(origin), destination: toLngLatParam(destination) }
    }).then(function (res) {
        if (res.data.status !== '1') return null;
        var path = res.data.route && res.data.route.paths && res.data.route.paths[0];
        if (!path) return null;
        return path.steps.reduce(function (acc, step) {
            return acc.concat(parsePolyline(step.polyline));
        }, []);
    });
}

// Public-transit legs are multi-segment (walk to a stop, ride a bus/subway
// line, walk again, ...) rather than one continuous road — each segment
// object always carries every segment-type key (taxi/walking/bus/entrance/
// exit/railway), populated only for the type that segment actually is, so
// concatenating whichever of walking/bus/railway each segment has (in
// order) reconstructs the full rider's path across the whole trip. Subway
// lines come back under the same `bus` key as surface bus lines (Amap
// distinguishes them via `type`, e.g. "地铁线路" vs a bus route name) — both
// carry a real polyline the same way, so no special-casing needed here.
function fetchTransitPath(key, origin, destination, city) {
    return axios.get(TRANSIT_URL, {
        params: {
            key: key,
            origin: toLngLatParam(origin),
            destination: toLngLatParam(destination),
            city: toAmapCityParam(city) || '',
            extensions: 'base'
        }
    }).then(function (res) {
        if (res.data.status !== '1') return null;
        var transit = res.data.route && res.data.route.transits && res.data.route.transits[0];
        if (!transit) return null;
        return transit.segments.reduce(function (acc, seg) {
            if (seg.walking && seg.walking.steps) {
                seg.walking.steps.forEach(function (step) { acc.push.apply(acc, parsePolyline(step.polyline)); });
            }
            if (seg.bus && seg.bus.buslines && seg.bus.buslines[0]) {
                acc.push.apply(acc, parsePolyline(seg.bus.buslines[0].polyline));
            }
            if (seg.railway && seg.railway.polyline) {
                acc.push.apply(acc, parsePolyline(seg.railway.polyline));
            }
            return acc;
        }, []);
    });
}

// origin/destination are [lng, lat] pairs. mode mirrors itineraryPlanner.js's
// TRANSPORT_SPEEDS_KMH vocabulary — "taxi" has no dedicated Amap direction
// endpoint, so it rides on the driving one like "driving" does (a taxi
// follows the same roads a private car would). Resolves null (never
// rejects) on any failure or empty result, same as spotPhotos.js's
// findSpotPhoto() — a failed/unreachable leg just doesn't render on the map
// rather than breaking the rest of the itinerary's route.
function getRoutePath(origin, destination, mode, city) {
    var key = process.env.AMAP_WEB_SERVICE_KEY;
    if (!key) return Promise.resolve(null);

    var lookup;
    switch (mode) {
        case 'walking':
            lookup = fetchSimplePath(WALKING_URL, key, origin, destination);
            break;
        case 'driving':
        case 'taxi':
            lookup = fetchSimplePath(DRIVING_URL, key, origin, destination);
            break;
        case 'public_transit':
        default:
            lookup = fetchTransitPath(key, origin, destination, city);
            break;
    }

    return lookup
        .then(function (path) { return (path && path.length) ? path : null; })
        .catch(function (err) {
            console.error('Amap routing lookup failed:', err.message);
            return null;
        });
}

module.exports = { getRoutePath: getRoutePath };
