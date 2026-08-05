import {
    ADD_TRIP_MESSAGE,
    MERGE_TRIP_BRIEF,
    SET_ITINERARY_LOADING,
    SET_ITINERARY,
    TRIP_ERRORS,
    RESET_TRIP
} from "./types";
import axios from "axios";

// Send one intake chat turn: adds the user's message immediately, then merges
// whatever fields the backend's (placeholder) extraction pulls out of it and
// adds the bot's follow-up as a reply.
export const sendIntakeMessage = (message) => (dispatch, getState) => {
    dispatch({ type: ADD_TRIP_MESSAGE, payload: { text: message, sender: "user" } });

    const { tripBrief } = getState().trip;

    axios
        .post("/trip/intake", { message, tripBrief })
        .then(res => {
            const { reply, extractedFields } = res.data;
            if (extractedFields && Object.keys(extractedFields).length) {
                dispatch({ type: MERGE_TRIP_BRIEF, payload: extractedFields });
            }
            dispatch({ type: ADD_TRIP_MESSAGE, payload: { text: reply, sender: "bot" } });
        })
        .catch(err => {
            dispatch({
                type: TRIP_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
        });
};

export const updateTripBriefField = (field, value) => ({
    type: MERGE_TRIP_BRIEF,
    payload: { [field]: value }
});

export const generateItinerary = () => (dispatch, getState) => {
    const { tripBrief } = getState().trip;
    dispatch({ type: SET_ITINERARY_LOADING, payload: true });

    return axios
        .post("/trip/generate", { tripBrief })
        .then(res => {
            dispatch({ type: SET_ITINERARY, payload: res.data });
            return res.data;
        })
        .catch(err => {
            dispatch({
                type: TRIP_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
            dispatch({ type: SET_ITINERARY_LOADING, payload: false });
            throw err;
        });
};

export const saveTrip = () => (dispatch, getState) => {
    const { tripBrief, itinerary } = getState().trip;

    return axios
        .post("/trip", {
            destination: itinerary.destination,
            numOfTravelers: tripBrief.numOfTravelers,
            budget: tripBrief.budget,
            pace: tripBrief.pace,
            preferences: tripBrief.preferences,
            accommodation: tripBrief.accommodation,
            livingPreference: tripBrief.livingPreference,
            days: itinerary.days
        })
        .catch(err => {
            dispatch({
                type: TRIP_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
            throw err;
        });
};

export const resetTrip = () => ({ type: RESET_TRIP });
