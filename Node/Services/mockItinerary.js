// Placeholder itinerary generation. DS-Service does not yet expose a
// date/duration-aware trip planner (see /Users/alexjiang/DS-Service/APIs/deepseek.ts —
// /plantrip only accepts a freeform `query` and ignores everything else) and its
// spot-sourcing endpoint (/datasourcing/sourcespots) returns an unordered flat list
// for a single city, not a day-by-day plan. So this module fakes both steps —
// "source a flat rated spot list" and "arrange it into days" — behind the same
// two-stage shape a real integration will eventually use, so swapping in a real
// DS-Service call later only touches generateFlatSpots().
//
// Each day's spots (and its Start/EndLocation) are anchored to
// tripBrief.accommodation when it has real coordinates (see CLAUDE.md,
// "Planned: Lodging Flow", item #5) — today that's only the has-a-place path
// (real Amap lookup). The no-place suggestion stub in trip.js still returns
// null coordinates until it's wired to DS-Service's /datasourcing/sourceaccommodations,
// so that path still falls back to the old city-center placeholder below.

const SPOT_TEMPLATES = [
    { name: "Old Town Walking Tour", timeOfDay: "Morning" },
    { name: "Signature Local Market", timeOfDay: "Morning" },
    { name: "Iconic Viewpoint", timeOfDay: "Afternoon" },
    { name: "Historic Landmark", timeOfDay: "Afternoon" },
    { name: "Riverside Promenade", timeOfDay: "Afternoon" },
    { name: "Contemporary Art Museum", timeOfDay: "Afternoon" },
    { name: "Botanical Garden", timeOfDay: "Morning" },
    { name: "Rooftop Sunset Bar", timeOfDay: "Evening" },
    { name: "Traditional Cuisine Tasting", timeOfDay: "Evening" }
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
            Photo: PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length]
        };
    });
}

const SPOTS_PER_DAY = 3;

function generateMockItinerary(tripBrief) {
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
            StartLocation: anchor,
            EndLocation: anchor,
            Spots: flatSpots.slice(i * SPOTS_PER_DAY, (i + 1) * SPOTS_PER_DAY)
        };
    });

    return { destination, days, accommodation: tripBrief.accommodation || null };
}

module.exports = { generateMockItinerary };
