// Fallback itinerary generation, used by APIs/trip.js's /generate route only
// when the real path (Services/spotSourcing.js + Services/itineraryPlanner.js,
// backed by DS-Service) fails outright — a DS-Service network/HTTP error, or
// zero spots returned. Not the default path anymore; see CLAUDE.md, "Planned:
// Real Trip-Generation Data".
//
// Each day's spots are anchored to tripBrief.accommodation when it has real
// coordinates (see CLAUDE.md, "Planned: Lodging Flow", item #5) — today
// that's only the has-a-place path (real Amap lookup). The no-place
// suggestion stub in trip.js still returns null coordinates until it's wired
// to DS-Service's /datasourcing/sourceaccommodations, so that path still
// falls back to the city-center placeholder below.

// category matches DS-Service's SPOT_CATEGORIES vocabulary so the fallback
// path exercises itineraryPlanner.js's category-balancing the same way real
// sourced data does, instead of leaving every synthetic spot uncategorized.
const SPOT_TEMPLATES = [
    { name: "Old Town Walking Tour", timeOfDay: "Morning", category: "historical" },
    { name: "Signature Local Market", timeOfDay: "Morning", category: "shopping" },
    { name: "Iconic Viewpoint", timeOfDay: "Afternoon", category: "landmark" },
    { name: "Historic Landmark", timeOfDay: "Afternoon", category: "historical" },
    { name: "Riverside Promenade", timeOfDay: "Afternoon", category: "park" },
    { name: "Contemporary Art Museum", timeOfDay: "Afternoon", category: "museum" },
    { name: "Botanical Garden", timeOfDay: "Morning", category: "park" },
    { name: "Rooftop Sunset Bar", timeOfDay: "Evening", category: "nightlife" },
    { name: "Traditional Cuisine Tasting", timeOfDay: "Evening", category: "food" }
];

const PLACEHOLDER_PHOTOS = ["hawaii", "kyoto", "ny", "shanghai"];

// Coarse city center lookup just to scatter placeholder markers somewhere
// plausible on the map; defaults to Beijing to match Itinerary.js's existing
// fallback pattern.
const CITY_COORDS = {
    beijing: [116.397428, 39.90923],
    shanghai: [121.4737, 31.2304],
    paris: [2.3522, 48.8566],
    tokyo: [139.6917, 35.6895],
    "new york": [-74.006, 40.7128],
    bali: [115.0920, -8.3405],
    santorini: [25.4615, 36.3932],
    sydney: [151.2093, -33.8688]
};

function resolveCityCenter(destination) {
    const key = (destination || "").trim().toLowerCase();
    const match = Object.keys(CITY_COORDS).find(
        city => key.includes(city) || city.includes(key)
    );
    return CITY_COORDS[match] || CITY_COORDS.beijing;
}

// The accommodation only has real coordinates once it's gone through the
// Amap lookup (has-a-place path) — the no-place suggestion stub still
// returns null Latitude/Longitude, so that case falls back to the same
// coarse city-center guess used before accommodation existed.
function resolveAnchorLocation(tripBrief, destination) {
    const accommodation = tripBrief.accommodation;
    if (accommodation && typeof accommodation.Latitude === "number" && typeof accommodation.Longitude === "number") {
        return {
            Name: accommodation.Name,
            Address: accommodation.Address || null,
            Latitude: accommodation.Latitude,
            Longitude: accommodation.Longitude
        };
    }

    const [lng, lat] = resolveCityCenter(destination);
    return {
        Name: `${destination} (approximate center)`,
        Address: null,
        Latitude: lat,
        Longitude: lng
    };
}

function jitter(value, spread) {
    return value + (Math.random() - 0.5) * spread;
}

function generateFlatSpots(destination, count, anchor) {
    const baseLat = anchor.Latitude;
    const baseLng = anchor.Longitude;

    return Array.from({ length: count }, (_, i) => {
        const template = SPOT_TEMPLATES[i % SPOT_TEMPLATES.length];
        return {
            Name: `${template.name} (${destination})`,
            StreetAddress: "Address not yet available",
            City: destination,
            StateOrProvince: "",
            Country: "",
            Latitude: jitter(baseLat, 0.08),
            Longitude: jitter(baseLng, 0.08),
            BestTimeToVisitInDay: {
                Description: template.timeOfDay,
                StartTime: null,
                EndTime: null
            },
            BestTimeToVisitInYear: {
                Description: "Year-round",
                Months: []
            },
            AverageTimeSpent: {
                Description: "A couple of hours",
                MinMinutes: 60,
                MaxMinutes: 150
            },
            Fees: {
                Currency: null,
                Adult: null,
                Senior: null,
                Child: null,
                Parking: null,
                Vehicle: null,
                Notes: "Placeholder data — pricing not yet available"
            },
            Rating: Math.round(60 + Math.random() * 35),
            Category: template.category,
            Photo: PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length]
        };
    });
}

const { SPOTS_PER_DAY } = require('./itineraryPlanner');

function generateFallbackItinerary(tripBrief) {
    const destination = tripBrief.destination || "Your Destination";
    const duration = Math.max(1, Math.min(14, Number(tripBrief.duration) || 3));

    const anchor = resolveAnchorLocation(tripBrief, destination);
    const flatSpots = generateFlatSpots(destination, duration * SPOTS_PER_DAY, anchor);

    const startDate = tripBrief.startDate ? new Date(tripBrief.startDate) : null;
    const days = Array.from({ length: duration }, (_, i) => {
        const dayDate = startDate ? new Date(startDate.getTime() + i * 86400000) : null;
        return {
            DayNumber: i + 1,
            Date: dayDate,
            Spots: flatSpots.slice(i * SPOTS_PER_DAY, (i + 1) * SPOTS_PER_DAY)
        };
    });

    return { destination, days, accommodation: tripBrief.accommodation || null };
}

module.exports = { generateFallbackItinerary };
