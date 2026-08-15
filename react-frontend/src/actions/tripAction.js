import {
    ADD_TRIP_MESSAGE,
    MERGE_TRIP_BRIEF,
    SET_ITINERARY_LOADING,
    SET_ITINERARY,
    TRIP_ERRORS,
    RESET_TRIP,
    ADD_REFINEMENT_MESSAGE,
    SET_REFINEMENT_STAGE,
    SET_REFINEMENT_LOADING,
    REFINEMENT_ERRORS,
    RESET_REFINEMENT,
    UPDATE_ITINERARY,
    SET_ACCOMMODATION_CANDIDATES,
    SET_MY_TRIPS_LOADING,
    SET_MY_TRIPS,
    MY_TRIPS_ERRORS
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
    // Clear any leftover refinement conversation from a previously
    // generated itinerary — otherwise a stale chat could carry over onto a
    // brand new trip if the user regenerates without ever navigating away.
    dispatch({ type: RESET_REFINEMENT });
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
            transportMode: tripBrief.transportMode,
            preferences: tripBrief.preferences,
            // itinerary.accommodation, not tripBrief.accommodation — the
            // no-place path never sets accommodation on tripBrief at all
            // anymore (see CLAUDE.md's resolved accommodation-timing bug);
            // a post-generation pick via the refinement chat only ever
            // lands on itinerary.accommodation (see itineraryPlanner.js's
            // applyAccommodation()), which is the authoritative post-edit
            // state here, same as itinerary.days already is below.
            accommodation: itinerary.accommodation,
            arrivalPoint: tripBrief.arrivalPoint,
            departurePoint: tripBrief.departurePoint,
            livingPreference: tripBrief.livingPreference,
            days: itinerary.days,
            startDate: tripBrief.startDate
        })
        .catch(err => {
            dispatch({
                type: TRIP_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
            throw err;
        });
};

// Opens the Itinerary page's refinement conversation — a static, local-only
// opening turn (the "confirm" half of the confirm-then-modify flow) needing
// no backend round-trip; only the traveler's yes/no answer hits the server.
export const startRefinementConversation = () => (dispatch) => {
    dispatch({ type: ADD_REFINEMENT_MESSAGE, payload: { text: 'Want to change anything about this plan? (yes/no)', sender: 'bot' } });
    dispatch({ type: SET_REFINEMENT_STAGE, payload: 'confirm' });
};

// One turn of the post-generation refinement chat. Same shape as
// sendIntakeMessage above, but against the separate refinement state (see
// tripReducer.js) and POST /trip/refine, which is fully stateless like
// /trip/intake — the client resends the current itinerary and stage every
// turn rather than the backend addressing a saved trip.
export const sendRefinementMessage = (message) => (dispatch, getState) => {
    dispatch({ type: ADD_REFINEMENT_MESSAGE, payload: { text: message, sender: 'user' } });
    dispatch({ type: SET_REFINEMENT_LOADING, payload: true });

    const { itinerary, refinementStage, accommodationCandidates } = getState().trip;

    return axios
        // accommodationCandidates is resent the same way itinerary/
        // refinementStage are — /trip/refine is fully stateless, so the
        // client must resend whatever candidate list REFINE_STAGES.
        // PICK_ACCOMMODATION last presented (same pattern /trip/intake
        // already uses for its own accommodationCandidates).
        .post('/trip/refine', { message, itinerary, refinementStage, accommodationCandidates })
        .then(res => {
            const { reply, stage, itinerary: updatedItinerary, accommodationCandidates: newCandidates } = res.data;
            if (updatedItinerary) {
                dispatch({ type: UPDATE_ITINERARY, payload: updatedItinerary });
            }
            // Cleared automatically once the flow moves past picking — the
            // server only includes accommodationCandidates in its response
            // while presenting/re-prompting the list.
            dispatch({ type: SET_ACCOMMODATION_CANDIDATES, payload: newCandidates || [] });
            dispatch({ type: ADD_REFINEMENT_MESSAGE, payload: { text: reply, sender: 'bot' } });
            dispatch({ type: SET_REFINEMENT_STAGE, payload: stage });
            dispatch({ type: SET_REFINEMENT_LOADING, payload: false });
        })
        .catch(err => {
            dispatch({
                type: REFINEMENT_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
            dispatch({ type: SET_REFINEMENT_LOADING, payload: false });
        });
};

export const resetTrip = () => ({ type: RESET_TRIP });

// Loads an already-saved trip (from the profile page's trip history) into
// the same `itinerary` state a fresh /trip/generate call would populate, so
// the Itinerary page can render it unchanged. GET /trip/:id returns the raw
// Mongo document (capitalized top-level fields, matching DB_Trip.js);
// /trip/generate's response uses lowercase top-level keys instead (nested
// Day/Spot/Accommodation/PlacePoint shapes already match either way, since
// itineraryPlanner.js builds those directly from the same schema shapes) —
// this maps between the two. `_id` is carried through so Itinerary.js can
// tell a history-loaded itinerary apart from a freshly generated one (see
// its Save button).
export const loadTripById = (tripId) => (dispatch) => {
    dispatch({ type: RESET_REFINEMENT });
    dispatch({ type: SET_ITINERARY_LOADING, payload: true });

    return axios
        .get(`/trip/${tripId}`)
        .then(res => {
            const trip = res.data;
            const mapped = {
                _id: trip._id,
                destination: trip.Destination,
                days: trip.Days,
                accommodation: trip.Accommodation || null,
                arrivalPoint: trip.ArrivalPoint || null,
                departurePoint: trip.DeparturePoint || null,
                budget: trip.Budget || null,
                transportMode: trip.TransportMode || null
            };
            dispatch({ type: SET_ITINERARY, payload: mapped });
            return mapped;
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

// Fetches the logged-in traveler's saved trips for the profile page's
// history section, already split into past/upcoming by the backend.
export const getMyTrips = () => (dispatch) => {
    dispatch({ type: SET_MY_TRIPS_LOADING, payload: true });

    return axios
        .get('/trip/mine')
        .then(res => {
            dispatch({ type: SET_MY_TRIPS, payload: res.data });
        })
        .catch(err => {
            dispatch({
                type: MY_TRIPS_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
        });
};
