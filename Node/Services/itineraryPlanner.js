// Arranges a flat, real-sourced spot list (from Services/spotSourcing.js) into
// day-by-day groups via geographic clustering — not a naive ordered slice —
// so a day's plan doesn't zigzag across the whole city. No DS-Service or
// Mongo dependency, so the clustering/day-sizing logic is easy to
// hand-verify against fixture spot arrays; the one external call is
// assignPhotos()'s per-spot Amap photo lookup (Services/spotPhotos.js).
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

const spotPhotos = require('./spotPhotos');
const spotSourcing = require('./spotSourcing');

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

// Sorts accommodation candidates by distance from the itinerary's actual
// spot centroid, nearest first — the proximity-biasing DS-Service's
// /datasourcing/sourceaccommodations contract doesn't support yet (city+
// budget only, see DS-Service's CLAUDE.md). Lives here rather than in
// APIs/trip.js so it can reuse computeCentroid/haversineDistance directly
// without exporting either of those low-level private helpers — same
// encapsulation convention this file already follows (buildRoute stays
// private too, exposed only via composed operations like arrangeIntoDays/
// replaceSpotInDay). Candidates with no real coordinates (the fallback/
// unverified placeholder pair from trip.js's fallbackSuggestions()) sort to
// the end rather than being dropped — same graceful-degradation contract
// suggestAccommodations() already has. No spots yet (e.g. a fallback
// itinerary with none sourced) returns candidates in their original order.
function sortAccommodationsByProximity(candidates, spots) {
    if (!spots.length) return candidates.slice();
    const anchor = computeCentroid(spots);
    const withCoords = candidates.filter(hasCoordinates);
    const withoutCoords = candidates.filter((c) => !hasCoordinates(c));
    withCoords.sort((a, b) => haversineDistance(anchor, a) - haversineDistance(anchor, b));
    return withCoords.concat(withoutCoords);
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

// Real photo per spot via Services/spotPhotos.js (Amap place lookup), one
// lookup per spot run in parallel; any spot whose lookup fails or comes back
// empty falls back to the placeholder cycle rather than leaving the spot
// photo-less.
async function assignPhotos(orderedSpots) {
    const photos = await Promise.all(
        orderedSpots.map((spot) => spotPhotos.findSpotPhoto(spot.Name, spot.City))
    );
    return orderedSpots.map((spot, i) =>
        Object.assign({}, spot, { Photo: photos[i] || PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length] })
    );
}

function hasCoordinates(point) {
    return !!point && typeof point.Latitude === "number" && typeof point.Longitude === "number";
}

function toRouteStop(type, point) {
    return { Type: type, Name: point.Name, Address: point.Address, Latitude: point.Latitude, Longitude: point.Longitude };
}

// Builds a day's visible route in true visiting order — see CLAUDE.md,
// "Collect arrival/departure points...". Unverified/placeholder points (no
// real Lat/Lng, e.g. an Amap lookup that failed) are left out entirely
// rather than plotted at a fake location; the day's Spots list still shows
// them, this is purely the map's route line.
function buildRoute(daySpots, dayIndex, totalDays, accommodation, arrivalPoint, departurePoint) {
    const route = [];
    const accommodationKnown = hasCoordinates(accommodation);

    if (dayIndex === 0 && hasCoordinates(arrivalPoint)) route.push(toRouteStop('arrival', arrivalPoint));
    if (accommodationKnown) route.push(toRouteStop('accommodation', accommodation));
    daySpots.forEach((spot) => route.push(toRouteStop('spot', spot)));
    if (accommodationKnown) route.push(toRouteStop('accommodation', accommodation));
    if (dayIndex === totalDays - 1 && hasCoordinates(departurePoint)) route.push(toRouteStop('departure', departurePoint));

    return route;
}

// pace and transportMode are real (see APIs/trip.js) but still
// optional/defaulted here so existing callers that predate either keep
// working unchanged. arrivalPoint/departurePoint are optional too — a
// traveler who never answered those questions just gets a route with no
// arrival/departure bookend, not a missing itinerary.
async function arrangeIntoDays(spots, duration, accommodation, pace, transportMode, arrivalPoint, departurePoint) {
    const safeDuration = Math.max(1, Math.min(14, Number(duration) || 1));
    const safePace = PACE_ACTIVE_BUDGET_MINUTES[pace] ? pace : DEFAULT_PACE;
    const safeTransportMode = TRANSPORT_SPEEDS_KMH[transportMode] ? transportMode : DEFAULT_TRANSPORT_MODE;

    if (!spots.length) {
        return Array.from({ length: safeDuration }, (_, i) => ({
            DayNumber: i + 1,
            Date: null,
            Spots: [],
            Route: buildRoute([], i, safeDuration, accommodation, arrivalPoint, departurePoint)
        }));
    }

    const anchorPoint = resolveAnchorPoint(spots, accommodation);
    const tour = buildGreedyTour(spots, anchorPoint);
    const withPhotos = await assignPhotos(tour);
    const groups = splitIntoDays(withPhotos, safeDuration, safeTransportMode, anchorPoint, safePace);

    return groups.map((daySpots, i) => ({
        DayNumber: i + 1,
        Date: null,
        Spots: daySpots,
        Route: buildRoute(daySpots, i, groups.length, accommodation, arrivalPoint, departurePoint)
    }));
}

// How many candidates to over-fetch from DS-Service when sourcing a
// replacement spot for a swap — /datasourcing/sourcespots has no
// exclude-list/category-bias parameter (see DS-Service's CLAUDE.md API
// Contract), so this pulls the widest pool the contract allows and
// filters/excludes client-side instead. 40 is that contract's own
// documented minCount cap.
const REPLACEMENT_OVERFETCH_MIN_COUNT = 40;

// Finds the spot in `daySpots` a free-text hint most likely refers to — an
// exact/partial name match first (either direction, so "museum" matches
// "National Museum of China" and vice versa), falling back to a category
// match (hint "the museum" against Category "museum"). A day with exactly
// one spot has no ambiguity to resolve even with no hint at all; otherwise
// no match returns -1 rather than guessing.
function findTargetSpotIndex(daySpots, hint) {
    if (!hint) return daySpots.length === 1 ? 0 : -1;
    const lowerHint = hint.toLowerCase();
    const byName = daySpots.findIndex((s) => {
        const lowerName = s.Name.toLowerCase();
        return lowerName.includes(lowerHint) || lowerHint.includes(lowerName);
    });
    if (byName !== -1) return byName;
    return daySpots.findIndex((s) => s.Category && lowerHint.includes(s.Category.toLowerCase()));
}

// Sources a replacement spot for a swap: over-fetches the destination's spot
// pool, excludes anything already anywhere in the itinerary (by name), and
// prefers the requested category if one was given — falling back to any
// non-duplicate if the category has no match, rather than failing outright.
// Highest-rated candidate wins.
async function findReplacementSpot(destination, usedNamesLower, replacementCategory) {
    const pool = await spotSourcing.sourceSpots(destination, REPLACEMENT_OVERFETCH_MIN_COUNT);
    const candidates = pool.filter((s) => !usedNamesLower.has(s.Name.toLowerCase()));

    const categoryMatched = replacementCategory ? candidates.filter((s) => s.Category === replacementCategory) : [];
    const pickFrom = categoryMatched.length ? categoryMatched : candidates;
    if (!pickFrom.length) return null;

    pickFrom.sort((a, b) => (b.Rating || 0) - (a.Rating || 0));
    const chosen = pickFrom[0];

    const photo = await spotPhotos.findSpotPhoto(chosen.Name, chosen.City).catch(() => null);
    return Object.assign({}, chosen, { Photo: photo || PLACEHOLDER_PHOTOS[0] });
}

// Applies a single-spot swap within one day — the one architecturally cheap
// edit operation this file supports. Deliberately does NOT touch
// buildGreedyTour/splitIntoDays: those run one continuous, order-dependent
// pass over every spot in the trip at once (see this file's header comment),
// so "regenerate day N" isn't a well-defined operation without reshuffling
// every other day too. A swap only needs buildRoute() recomputed for the
// one affected day — already pure and day-local, no dependency on other
// days. Operates purely on the in-memory itinerary object the caller
// already holds (the same shape arrangeIntoDays/`/trip/generate` produce) —
// no Mongo access, so DB_Trip.js's `Days`/`Spots` sub-schemas being
// `{ _id: false }` (no stable per-day/per-spot ids) never comes into play.
async function replaceSpotInDay(itinerary, dayNumber, targetSpotHint, replacementCategory) {
    const days = itinerary.days || [];
    const dayIndex = days.findIndex((d) => d.DayNumber === dayNumber);
    if (dayIndex === -1) {
        return { ok: false, reply: `I couldn't find day ${dayNumber} in this itinerary — this trip only has ${days.length} day${days.length === 1 ? '' : 's'}.` };
    }

    const day = days[dayIndex];
    const spotIndex = findTargetSpotIndex(day.Spots, targetSpotHint);
    if (spotIndex === -1) {
        return { ok: false, reply: `I couldn't tell which spot on day ${dayNumber} you meant — could you name it more specifically?` };
    }

    const targetSpot = day.Spots[spotIndex];
    const usedNames = new Set(days.flatMap((d) => d.Spots.map((s) => s.Name.toLowerCase())));

    const replacement = await findReplacementSpot(itinerary.destination, usedNames, replacementCategory);
    if (!replacement) {
        return { ok: false, reply: `I couldn't find a good replacement for ${targetSpot.Name} right now — try a different category, or try again in a moment.` };
    }

    const newDaySpots = day.Spots.slice();
    newDaySpots[spotIndex] = replacement;

    const newDay = Object.assign({}, day, {
        Spots: newDaySpots,
        Route: buildRoute(newDaySpots, dayIndex, days.length, itinerary.accommodation, itinerary.arrivalPoint, itinerary.departurePoint)
    });

    const newDays = days.slice();
    newDays[dayIndex] = newDay;

    return {
        ok: true,
        reply: `Swapped ${targetSpot.Name} for ${replacement.Name} on day ${dayNumber}.`,
        itinerary: Object.assign({}, itinerary, { days: newDays })
    };
}

// Applies a traveler's post-generation accommodation pick (see
// APIs/trip.js's REFINE_STAGES.PICK_ACCOMMODATION) and recomputes every
// day's Route, since buildRoute() takes accommodation as a bookend
// parameter for every day, not just one. Unlike replaceSpotInDay, this
// touches every day (not just one), but deliberately still does NOT touch
// Spots or day clustering — re-clustering all spots around a new anchor is
// the same kind of expensive, not-well-defined "regenerate everything"
// operation replaceSpotInDay's own doc comment already argues against;
// picking a hotel doesn't change which spots exist or which day they're
// in, only where each day's route starts/ends. Synchronous (no DS-Service
// call needed, unlike replaceSpotInDay), and assumes itinerary.days is in
// DayNumber-ascending array order — the same assumption arrangeIntoDays's
// own output already guarantees and replaceSpotInDay's splice preserves.
// Works unmodified even on a day object with no Route field at all (e.g.
// fallbackItinerary.js's output) since buildRoute() is always called fresh
// here rather than reading the day's existing Route.
function applyAccommodation(itinerary, accommodation) {
    const days = itinerary.days || [];
    const newDays = days.map((day, i) => {
        const daySpots = day.Spots || [];
        return Object.assign({}, day, {
            Route: buildRoute(daySpots, i, days.length, accommodation, itinerary.arrivalPoint, itinerary.departurePoint)
        });
    });
    return Object.assign({}, itinerary, { accommodation, days: newDays });
}

module.exports = { arrangeIntoDays, replaceSpotInDay, applyAccommodation, sortAccommodationsByProximity, SPOTS_PER_DAY, SPOT_REQUEST_BUFFER_MULTIPLIER };
