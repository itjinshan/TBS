const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
    FirstName:{
        type: String,
        required: true
    },
    LastName:{
        type: String,
        required: true
    },
    MiddleName:{
        type: String,
    },
    Email:{
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    Phone:{
        type: String,
        required: true,
        unique: true,
        default: "xxx"
    },
    Password:{
        type: String,
        required: true
    },
    ResetToken:{
        type: String,
        default: "token"
    },
    CreationDate:{
        type: Date,
        default: Date.now
    },
    Language:{
        type: String,
        default: "English"
    },
    TripHistory:[{
        TripID:{
            type: Schema.Types.ObjectId,
            ref: "Trips"
        }
    }]
})

module.exports = mongoose.model("Users", UserSchema);