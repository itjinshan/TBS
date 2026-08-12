const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Field names mirror DS-Service's DestinationSpot model (see /Users/alexjiang/DS-Service/DB_Models/DB_DestinationSpot.ts)
// so a real sourced spot can be embedded here later with no reshape.
const SpotSchema = new Schema({
    Name: { type: String, required: true },
    StreetAddress: { type: String },
    City: { type: String },
    StateOrProvince: { type: String },
    Country: { type: String },
    Latitude: { type: Number, required: true },
    Longitude: { type: Number, required: true },
    BestTimeToVisitInDay: {
        Description: { type: String },
        StartTime: { type: String },
        EndTime: { type: String }
    },
    BestTimeToVisitInYear: {
        Description: { type: String },
        Months: [{ type: String }]
    },
    AverageTimeSpent: {
        Description: { type: String },
        MinMinutes: { type: Number },
        MaxMinutes: { type: Number }
    },
    Fees: {
        Currency: { type: String },
        Adult: { type: Number },
        Senior: { type: Number },
        Child: { type: Number },
        Parking: { type: Number },
        Vehicle: { type: Number },
        Notes: { type: String }
    },
    Rating: { type: Number }, // 0-100 worthiness score, matches DS-Service's scale
    Category: { type: String }, // e.g. "museum", "food" — see DS-Service's SPOT_CATEGORIES; absent on older/uncategorized spots
    Photo: { type: String } // live Amap photo URL (Services/spotPhotos.js) if found, else a placeholder key from itineraryPlanner.js's PLACEHOLDER_PHOTOS — not sourced by DS-Service, not persisted/cached beyond this trip document
}, { _id: false });

// Shared shape for a resolved real-world place (Amap-looked-up or an
// unverified fallback with null Lat/Lng — see Services/amapPlaces.js and
// APIs/trip.js's lookupPlaceCandidates). Used for the trip-level
// ArrivalPoint/DeparturePoint below.
const PlacePointSchema = new Schema({
    Name: { type: String },
    Address: { type: String },
    Latitude: { type: Number },
    Longitude: { type: Number }
}, { _id: false });

// One stop in a day's visible route, in visiting order — built by
// Services/itineraryPlanner.js's buildRoute(). "arrival"/"departure" only
// ever appear on day 1/the last day respectively; "accommodation" brackets
// every day's spots (a day starts and ends back at the traveler's lodging);
// "spot" mirrors that day's Spots array, in the same order. Purely for the
// Itinerary map's route line — the spot cards themselves still read from
// Spots, not this.
const RouteStopSchema = new Schema({
    Type: { type: String, enum: ['arrival', 'accommodation', 'spot', 'departure'], required: true },
    Name: { type: String },
    Address: { type: String },
    Latitude: { type: Number },
    Longitude: { type: Number }
}, { _id: false });

const DaySchema = new Schema({
    DayNumber: { type: Number, required: true },
    Date: { type: Date },
    Spots: [SpotSchema],
    Route: [RouteStopSchema]
}, { _id: false });

// Anchors each day's starting location (see CLAUDE.md, "Planned: Lodging
// Flow"). Name isn't required — the frontend chip UI (still on the old
// REQUIRED_FIELDS gate until lodging-flow item #6 lands) can currently save
// a trip before accommodation is ever asked about.
const AccommodationSchema = new Schema({
    Name: { type: String },
    Address: { type: String },
    Latitude: { type: Number },
    Longitude: { type: Number },
    Source: { type: String, enum: ['user-provided', 'suggested'] }
}, { _id: false });

const TripSchema = new Schema({
    Owner: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    Destination: {
        type: String,
        required: true
    },
    Duration: {
        type: Number,
        required: true
    },
    NumOfTravelers: {
        type: Number,
        default: 1
    },
    Budget: {
        type: String,
        default: "mid-range"
    },
    Pace: {
        type: String,
        default: "standard" // "relaxed" | "standard" | "packed" — see Services/itineraryPlanner.js's PACE_ACTIVE_BUDGET_MINUTES
    },
    TransportMode: {
        type: String,
        default: "public_transit" // "walking" | "public_transit" | "taxi" | "driving" — see Services/itineraryPlanner.js's TRANSPORT_SPEEDS_KMH
    },
    Preferences: {
        type: String
    },
    Accommodation: {
        type: AccommodationSchema
    },
    ArrivalPoint: {
        type: PlacePointSchema
    },
    DeparturePoint: {
        type: PlacePointSchema
    },
    LivingPreference: {
        type: String
    },
    Days: [DaySchema],
    CreatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Trips", TripSchema);
