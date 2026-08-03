// Arranges a flat, real-sourced spot list (from Services/spotSourcing.js) into
// day-by-day groups via geographic clustering — not a naive ordered slice —
// so a day's plan doesn't zigzag across the whole city. Pure and local: no
// DS-Service or Mongo dependency, so it's easy to hand-verify against fixture
// spot arrays.
//
// Algorithm: greedy nearest-neighbor tour (from an anchor point — the
// accommodation if it has real coordinates, else the spot centroid) sliced
// into balanced contiguous day-chunks. Chosen over a k-means-style capacity
// clustering because with a small, non-divisible spot count (e.g. 13 spots /
// 5 days) a capacity-constrained k-means needs iterative convergence with
// edge cases (empty/overflowing clusters); a greedy tour + slice is O(n^2)
// (trivial at this scale), deterministic, and guarantees exact day-size
// balance by construction rather than as a convergence outcome.

const SPOTS_PER_DAY = 3;
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

// Balanced contiguous chunks: first `n % duration` days get one extra spot.
// If n < duration, the first n days get exactly one spot and the rest get
// none — graceful degradation for short spot pools, no special-casing needed.
function splitIntoDays(orderedSpots, duration) {
    const n = orderedSpots.length;
    const base = Math.floor(n / duration);
    const remainder = n % duration;

    const groups = [];
    let index = 0;
    for (let day = 0; day < duration; day++) {
        const size = base + (day < remainder ? 1 : 0);
        groups.push(orderedSpots.slice(index, index + size));
        index += size;
    }
    return groups;
}

function assignPhotos(orderedSpots) {
    return orderedSpots.map((spot, i) =>
        Object.assign({}, spot, { Photo: PLACEHOLDER_PHOTOS[i % PLACEHOLDER_PHOTOS.length] })
    );
}

function arrangeIntoDays(spots, duration, accommodation) {
    const safeDuration = Math.max(1, Math.min(14, Number(duration) || 1));

    if (!spots.length) {
        return Array.from({ length: safeDuration }, (_, i) => ({ DayNumber: i + 1, Date: null, Spots: [] }));
    }

    const anchorPoint = resolveAnchorPoint(spots, accommodation);
    const tour = buildGreedyTour(spots, anchorPoint);
    const withPhotos = assignPhotos(tour);
    const groups = splitIntoDays(withPhotos, safeDuration);

    return groups.map((daySpots, i) => ({ DayNumber: i + 1, Date: null, Spots: daySpots }));
}

module.exports = { arrangeIntoDays, SPOTS_PER_DAY };
