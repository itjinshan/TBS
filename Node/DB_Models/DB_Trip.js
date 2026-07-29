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
    Photo: { type: String } // frontend placeholder only, not sourced by DS-Service
}, { _id: false });

const DaySchema = new Schema({
    DayNumber: { type: Number, required: true },
    Date: { type: Date },
    Spots: [SpotSchema]
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
    Preferences: {
        type: String
    },
    Days: [DaySchema],
    CreatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Trips", TripSchema);
