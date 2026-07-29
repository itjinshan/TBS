import {
    ADD_TRIP_MESSAGE,
    MERGE_TRIP_BRIEF,
    SET_ITINERARY_LOADING,
    SET_ITINERARY,
    TRIP_ERRORS,
    RESET_TRIP
} from "../actions/types";

const initialState = {
    tripBrief: {},
    messages: [],
    isGenerating: false,
    itinerary: null,
    error: null
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
                error: null
            };
        case TRIP_ERRORS:
            return {
                ...state,
                error: action.payload
            };
        case RESET_TRIP:
            return initialState;
        default:
            return state;
    }
}
