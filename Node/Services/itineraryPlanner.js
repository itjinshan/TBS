// Arranges a flat, real-sourced spot list (from Services/spotSourcing.js) into
// day-by-day groups via geographic clustering — not a naive ordered slice —
// so a day's plan doesn't zigzag across the whole city. Pure and local: no
// DS-Service or Mongo dependency, so it's easy to hand-verify against fixture
// spot arrays.
//
// Algorithm: greedy nearest-neighbor tour (from an anchor point — the
// accommodation if it has real coordinates, else the spot centroid) is built
// once up front to fix a geographically-sensible visiting order; a day-by-day
// walk over that tour then decides how many of those spots each day actually
// holds. Chosen over a k-means-style capacity clustering because with a
// small, non-divisible spot count (e.g. 13 spots / 5 days) a
// capacity-constrained k-means needs iterative convergence with edge cases
// (empty/overflowing clusters); a greedy tour + walk is O(n^2) (trivial at
// this scale) and deterministic.
//
// The day-by-day walk (splitIntoDays) is time-budget-aware, not a fixed
// spot-per-day count: each day accumulates travel time (from an anchor point,
// reset every morning — see below) plus each spot's own visit time, and
// stops taking new spots once the next one would exceed the day's active
// budget (a day always gets at least one spot, even if that spot alone
// exceeds the budget — see the edge case note on splitIntoDays). The size of
// that budget itself comes from the traveler's chosen vacation pace —
// relaxed, standard, or packed (PACE_ACTIVE_BUDGET_MINUTES below) — so the
// same spot pool produces a noticeably lighter or fuller day depending on
// which the traveler picked. Either way it naturally produces variable
// spots-per-day: more for a day of quick, close-together spots, fewer for a
// day with a big museum or long transfers.
// It also still biases toward a varied category mix within each day —
// geography and time stay the primary signal (a day is still built from a
// contiguous run of the tour, spot-by-spot), but a same-category repeat is
// swapped for a fresh-category spot a few positions ahead when one's
// available and still fits the remaining budget.

// Three vacation-pace tiers a traveler can pick during intake (see
// APIs/trip.js's OTHER_PREF_FIELDS/OTHER_PREF_QUESTIONS and the "Pace" chip
// in TripIntakePanel.js), each with its own total day window and flat
// meal/rest allowance subtracted up front rather than scheduled at specific
// times (scheduling actual meal slots/restaurant picks is a separate,
// bigger feature). What's left is what a day actually has to spend on
// travel + visiting. "standard" matches this feature's original single
// fixed budget, so picking no pace at all behaves exactly as before.
const PACE_MINUTES = {
    relaxed: { dayBudget: 540, mealRestAllowance: 240 },
    standard: { dayBudget: 600, mealRestAllowance: 150 },
    packed: { dayBudget: 660, mealRestAllowance: 120 }
};
const PACE_ACTIVE_BUDGET_MINUTES = Object.keys(PACE_MINUTES).reduce((acc, pace) => {
    acc[pace] = PACE_MINUTES[pace].dayBudget - PACE_MINUTES[pace].mealRestAllowance;
    return acc;
}, {});
const DEFAULT_PACE = 'standard';

// Used when a spot's own AverageTimeSpent wasn't populated by the LLM.
const DEFAULT_VISIT_MINUTES = 90;

// Rough heuristics, not real routing precision — a real routing/distance-matrix
// API (Amap's, most likely, given it's already integrated) would be far more
// accurate but is a bigger follow-up. Public transit's speed already accounts
// for waits/transfers rather than modeling them separately; driving gets a
// flat parking-and-walk-to-venue buffer that taxi (curb-to-curb) doesn't need.
const TRANSPORT_SPEEDS_KMH = {
    walking: 4.5,
    public_transit: 20,
    taxi: 27,
    driving: 27
};
const DRIVING_PARKING_BUFFER_MINUTES = 10;

// No real per-trip transport-mode selection exists yet (planned as a
// follow-up intake field) — every caller currently gets this default.
const DEFAULT_TRANSPORT_MODE = 'public_transit';

const SPOTS_PER_DAY = 3; // still used as the average-case estimate for how many spots to request from DS-Service (see APIs/trip.js) and by the fallback generator's flat per-day slice — no longer a hard per-day cap for real day-arrangement, see splitIntoDays below.

// Now that day-sizing is time-based rather than a hard per-day count, the
// number of spots actually needed to fill `duration` days varies with how
// slow/spread-out the sourced spots happen to be — duration * SPOTS_PER_DAY
// is only an average-case guess. This pads the request so a trip with
// slower-than-average spots is still likely to have enough to fill every
// day, rather than running short partway through (see APIs/trip.js).
const SPOT_REQUEST_BUFFER_MULTIPLIER = 1.3;
const PLACEHOLDER_PHOTOS = ["hawaii", "kyoto", "ny", "shanghai"];

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function haversineDistance(a, b) {
    const EARTH_RADIUS_KM = 6371;
    const dLat = toRadians(b.Latitude - a.Latitude);
    const dLng = toRadians(b.Longitude - a.Longitude);
    const lat1 = toRadians(a.Latitude);
    const lat2 = toRadians(b.Latitude);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Midpoint of the LLM-provided range, biased toward whichever bound is
// actually present if only one is, falling back to a flat default if the
// LLM didn't populate either — never ignored, unlike before.
function getVisitMinutes(spot) {
    const timeSpent = spot.AverageTimeSpent || {};
    const min = timeSpent.MinMinutes;
    const max = timeSpent.MaxMinutes;
    if (typeof min === "number" && typeof max === "number") return (min + max) / 2;
    if (typeof min === "number") return min;
    if (typeof max === "number") return max;
    return DEFAULT_VISIT_MINUTES;
}

function estimateTravelMinutes(distanceKm, transportMode) {
    const speedKmh = TRANSPORT_SPEEDS_KMH[transportMode] || TRANSPORT_SPEEDS_KMH[DEFAULT_TRANSPORT_MODE];
    const travelMinutes = (distanceKm / speedKmh) * 60;
    const parkingBuffer = transportMode === "driving" ? DRIVING_PARKING_BUFFER_MINUTES : 0;
    return travelMinutes + parkingBuffer;
}

function computeCentroid(spots) {
    const sum = spots.reduce(
        (acc, spot) => ({ lat: acc.lat + spot.Latitude, lng: acc.lng + spot.Longitude }),
        { lat: 0, lng: 0 }
    );
    return { Latitude: sum.lat / spots.length, Longitude: sum.lng / spots.length };
}

// Accommodation only has real coordinates once it's gone through a real
// lookup (Amap has-a-place path, or a real DS-Service suggestion) — a
// placeholder/unverified accommodation still has null Lat/Lng, so this
// falls back to the spot centroid, same as when there's no accommodation
// at all yet.
function resolveAnchorPoint(spots, accommodation) {
    if (accommodation && typeof accommodation.Latitude === "number" && typeof accommodation.Longitude === "number") {
        return { Latitude: accommodation.Latitude, Longitude: accommodation.Longitude };
    }
    return computeCentroid(spots);
}

function buildGreedyTour(spots, anchorPoint) {
    const remaining = spots.slice();
    const tour = [];
    let current = anchorPoint;

    while (remaining.length) {
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const distance = haversineDistance(current, remaining[i]);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
            }
        }
        const [nearest] = remaining.splice(nearestIndex, 1);
        tour.push(nearest);
        current = nearest;
    }

    return tour;
}

// How far ahead splitIntoDays is willing to look, within the already
// geography-ordered tour, for a spot to swap in when the next-up one would
// repeat a category already placed in the current day. Small on purpose:
// spots this close together in tour order are already geographically
// close, so a swap within the window barely disturbs the day's geographic
// coherence while still meaningfully reducing thematic repeats.
const CATEGORY_LOOKAHEAD_WINDOW = 3;

// Each day starts back at the anchor point (the accommodation, or the spot
// centroid if there's no accommodation yet) rather than continuing straight
// on from wherever the previous day's last spot was — a traveler leaves
// from their hotel each morning, so budgeting day N's first travel leg
// against day N-1's endpoint would be unrealistic. The tour order itself
// (which spots even end up considered together for a given day) still comes
// from the single continuous nearest-neighbor walk, so this only affects the
// time math, not which spots cluster together.
//
// Within each day, defaults to taking the next spot in tour order, but if
// that spot's category is already used this day, looks a few spots ahead in
// the tour for one with a fresh category and pulls it forward instead — same
// as before category tagging became time-aware. A spot with no Category
// (older data, or the LLM didn't return one) never blocks and is never
// tracked as a duplicate.
//
// A day keeps taking spots until the next one (travel time from the
// traveler's current position, plus the spot's own visit time) would push
// the day past its active time budget — except a day always accepts its
// first spot regardless of cost, so a single spot whose own visit time
// exceeds the entire day's budget still gets a day to itself rather than
// being dropped.
function splitIntoDays(orderedSpots, duration, transportMode, anchorPoint, pace) {
    const remaining = orderedSpots.slice();
    const groups = [];
    const activeBudgetMinutes = PACE_ACTIVE_BUDGET_MINUTES[pace];

    for (let day = 0; day < duration; day++) {
        const usedCategories = new Set();
        const daySpots = [];
        let elapsedMinutes = 0;
        let currentPosition = anchorPoint;

        while (remaining.length) {
            let pickIndex = 0;
            if (remaining[0].Category && usedCategories.has(remaining[0].Category)) {
                const windowEnd = Math.min(remaining.length, CATEGORY_LOOKAHEAD_WINDOW + 1);
                for (let i = 1; i < windowEnd; i++) {
                    const candidateCategory = remaining[i].Category;
                    if (!candidateCategory || !usedCategories.has(candidateCategory)) {
                        pickIndex = i;
                        break;
                    }
                }
            }

            const candidate = remaining[pickIndex];
            const cost = estimateTravelMinutes(haversineDistance(currentPosition, candidate), transportMode) + getVisitMinutes(candidate);

            if (daySpots.length > 0 && elapsedMinutes + cost > activeBudgetMinutes) {
                break;
            }

            remaining.splice(pickIndex, 1);
            daySpots.push(candidate);
            if (candidate.Category) usedCategories.add(candidate.Category);
            elapsedMinutes += cost;
            currentPosition = candidate;
        }

        groups.push(daySpots);
    }
    return groups;
}

function assignPhotos(orderedSpots) {
    return orderedSpots.map((spot, i) =>
        Object.assign({}, spot, { Photo: PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length] })
    );
}

// transportMode isn't extracted from the trip intake yet (planned follow-up)
// — every caller currently omits it and gets DEFAULT_TRANSPORT_MODE. pace
// is real (see APIs/trip.js) but still optional/defaulted here so existing
// callers that predate it keep working unchanged.
function arrangeIntoDays(spots, duration, accommodation, pace, transportMode) {
    const safeDuration = Math.max(1, Math.min(14, Number(duration) || 1));
    const safePace = PACE_ACTIVE_BUDGET_MINUTES[pace] ? pace : DEFAULT_PACE;
    const safeTransportMode = TRANSPORT_SPEEDS_KMH[transportMode] ? transportMode : DEFAULT_TRANSPORT_MODE;

    if (!spots.length) {
        return Array.from({ length: safeDuration }, (_, i) => ({ DayNumber: i + 1, Date: null, Spots: [] }));
    }

    const anchorPoint = resolveAnchorPoint(spots, accommodation);
    const tour = buildGreedyTour(spots, anchorPoint);
    const withPhotos = assignPhotos(tour);
    const groups = splitIntoDays(withPhotos, safeDuration, safeTransportMode, anchorPoint, safePace);

    return groups.map((daySpots, i) => ({ DayNumber: i + 1, Date: null, Spots: daySpots }));
}

module.exports = { arrangeIntoDays, SPOTS_PER_DAY, SPOT_REQUEST_BUFFER_MULTIPLIER };
