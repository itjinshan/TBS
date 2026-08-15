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
    MY_TRIPS_ERRORS,
    SET_ITINERARY_ID,
    SET_TRIP_SAVING,
    TRIP_SAVE_ERROR
} from "../actions/types";

const initialState = {
    tripBrief: {},
    messages: [],
    isGenerating: false,
    itinerary: null,
    error: null,
    refinementMessages: [],
    isRefining: false,
    refinementStage: null, // null | 'confirm' | 'editing' | 'pick_accommodation' | 'done'
    refinementError: null,
    accommodationCandidates: [],
    myTrips: { past: [], upcoming: [] },
    myTripsLoading: false,
    myTripsError: null,
    isSavingTrip: false,
    tripSaveError: null
};

export default function (state = initialState, action) {
    switch (action.type) {
        case ADD_TRIP_MESSAGE:
            return {
                ...state,
                messages: [...state.messages, { id: state.messages.length + 1, ...action.payload }]
            };
        case MERGE_TRIP_BRIEF:
            return {
                ...state,
                tripBrief: { ...state.tripBrief, ...action.payload }
            };
        case SET_ITINERARY_LOADING:
            return {
                ...state,
                isGenerating: action.payload
            };
        case SET_ITINERARY:
            return {
                ...state,
                itinerary: action.payload,
                isGenerating: false,
                error: null,
                isSavingTrip: false,
                tripSaveError: null
            };
        case TRIP_ERRORS:
            return {
                ...state,
                error: action.payload
            };
        case RESET_TRIP:
            return initialState;
        case ADD_REFINEMENT_MESSAGE:
            return {
                ...state,
                refinementMessages: [...state.refinementMessages, { id: state.refinementMessages.length + 1, ...action.payload }]
            };
        case SET_REFINEMENT_STAGE:
            return {
                ...state,
                refinementStage: action.payload
            };
        case SET_REFINEMENT_LOADING:
            return {
                ...state,
                isRefining: action.payload
            };
        case REFINEMENT_ERRORS:
            return {
                ...state,
                refinementError: action.payload
            };
        case RESET_REFINEMENT:
            return {
                ...state,
                refinementMessages: [],
                isRefining: false,
                refinementStage: null,
                refinementError: null,
                accommodationCandidates: []
            };
        case UPDATE_ITINERARY:
            // POST /trip/refine is stateless and returns a fresh itinerary
            // object with no `_id` — carry the existing one forward (if any)
            // so autoSaveTrip() still knows to PUT rather than re-POST.
            return {
                ...state,
                itinerary: { ...action.payload, _id: state.itinerary?._id }
            };
        case SET_ITINERARY_ID:
            return {
                ...state,
                itinerary: { ...state.itinerary, _id: action.payload }
            };
        case SET_TRIP_SAVING:
            return {
                ...state,
                isSavingTrip: action.payload
            };
        case TRIP_SAVE_ERROR:
            return {
                ...state,
                tripSaveError: action.payload,
                isSavingTrip: false
            };
        case SET_ACCOMMODATION_CANDIDATES:
            return {
                ...state,
                accommodationCandidates: action.payload
            };
        case SET_MY_TRIPS_LOADING:
            return {
                ...state,
                myTripsLoading: action.payload
            };
        case SET_MY_TRIPS:
            return {
                ...state,
                myTrips: action.payload,
                myTripsLoading: false,
                myTripsError: null
            };
        case MY_TRIPS_ERRORS:
            return {
                ...state,
                myTripsError: action.payload,
                myTripsLoading: false
            };
        default:
            return state;
    }
}
