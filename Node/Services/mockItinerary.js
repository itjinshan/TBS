// Placeholder itinerary generation. DS-Service does not yet expose a
// date/duration-aware trip planner (see /Users/alexjiang/DS-Service/APIs/deepseek.ts —
// /plantrip only accepts a freeform `query` and ignores everything else) and its
// spot-sourcing endpoint (/datasourcing/sourcespots) returns an unordered flat list
// for a single city, not a day-by-day plan. So this module fakes both steps —
// "source a flat rated spot list" and "arrange it into days" — behind the same
// two-stage shape a real integration will eventually use, so swapping in a real
// DS-Service call later only touches generateFlatSpots().

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

function jitter(value, spread) {
    return value + (Math.random() - 0.5) * spread;
}

function generateFlatSpots(destination, count) {
    const [baseLng, baseLat] = resolveCityCenter(destination);

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

    const flatSpots = generateFlatSpots(destination, duration * SPOTS_PER_DAY);

    const startDate = tripBrief.startDate ? new Date(tripBrief.startDate) : null;
    const days = Array.from({ length: duration }, (_, i) => {
        const dayDate = startDate ? new Date(startDate.getTime() + i * 86400000) : null;
        return {
            DayNumber: i + 1,
            Date: dayDate,
            Spots: flatSpots.slice(i * SPOTS_PER_DAY, (i + 1) * SPOTS_PER_DAY)
        };
    });

    return { destination, days };
}

module.exports = { generateMockItinerary };
