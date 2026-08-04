var axios = require('axios');
var generateAccessToken = require('../Config/jwtgenerator');

// DS-Service's saved spot documents carry `City` as an unpopulated ObjectId
// and use `SpotName` (not `Name`) — reshape explicitly rather than passing
// the DS-Service document through as-is. `City` is set to the destination
// string TBS already requested with, not the ObjectId.
function reshapeSpot(spot, destination) {
    return {
        Name: spot.SpotName,
        StreetAddress: spot.StreetAddress,
        City: destination,
        StateOrProvince: spot.StateOrProvince,
        Country: spot.Country,
        Latitude: spot.Latitude,
        Longitude: spot.Longitude,
        BestTimeToVisitInDay: spot.BestTimeToVisitInDay,
        BestTimeToVisitInYear: spot.BestTimeToVisitInYear,
        AverageTimeSpent: spot.AverageTimeSpent,
        Fees: spot.Fees,
        Rating: spot.Rating,
        Category: spot.Category
    };
}

// Real spot sourcing via DS-Service's POST /datasourcing/sourcespots (see
// CLAUDE.md, "Planned: Real Trip-Generation Data", action item #2).
// DB-first-then-LLM-top-up happens entirely on DS-Service's side — this
// just requests at least `minCount` spots and reshapes the result.
//
// Deliberately does not catch/fall back internally (unlike
// suggestAccommodations() below) — the caller (trip.js's /generate) decides
// whether a rejection or a too-small result should fall back to
// fallbackItinerary, since that's a policy decision about the whole
// generation flow, not something this thin client should own.
function sourceSpots(destination, minCount) {
    var accessToken = generateAccessToken('', 'deepseek');
    return axios.post(process.env.DS_SERVICE_BASEURL + '/datasourcing/sourcespots', {
        token: accessToken,
        ds: 'deepseek',
        city: destination,
        minCount: minCount
    }).then(function (res) {
        var spots = res.data.spots || [];
        return spots.map(function (spot) { return reshapeSpot(spot, destination); });
    });
}

module.exports = { sourceSpots };
