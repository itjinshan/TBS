import{
    SET_LLM_RESPONSE,
    RESET_LLM_RESPONSE,
    LLM_ERRORS
} from "../actions/types";

const initialState = {
    hasNewResponse: false,
    llmResponse: {},
    llmError: false,
    llmErrorMessage: ""
};

export default function(state = initialState, action) { 
    switch (action.type) {
        case SET_LLM_RESPONSE:
            return {
                ...state,
                hasNewResponse: true,
                llmResponse: action.payload,
                llmError: false,
                llmErrorMessage: ""
            };
        case RESET_LLM_RESPONSE:
            return initialState;
        case LLM_ERRORS:
            return {
                ...state,
                llmError: true,
                llmErrorMessage: action.payload
            };
        default:
            return state;
    }
}