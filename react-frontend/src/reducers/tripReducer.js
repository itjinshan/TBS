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
    SET_ACCOMMODATION_CANDIDATES
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
    accommodationCandidates: []
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
            return {
                ...state,
                itinerary: action.payload
            };
        case SET_ACCOMMODATION_CANDIDATES:
            return {
                ...state,
                accommodationCandidates: action.payload
            };
        default:
            return state;
    }
}
