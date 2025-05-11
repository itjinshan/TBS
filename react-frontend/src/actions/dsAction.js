import { 
    SET_LLM_RESPONSE,
    LLM_ERRORS,
    GET_ERRORS,
    RESET_LLM_RESPONSE
     } from "./types";
import axios from "axios";

// General LLM chat
//
export const getLLMChat = (chatQuery) => dispatch => {
    axios
        .post("/dsservice", chatQuery)
        .then(res => {
            dispatch(setLLMResponse(res));
        })
        .catch(err => {
            dispatch({
                type: LLM_ERRORS,
            });
            dispatch({
                type: GET_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
        }
        );
};

export const setLLMResponse = (res) => {
    return {
        type: SET_LLM_RESPONSE,
        payload: res
    };
};

export const resetLLMResponse = () => {
    return {
        type: RESET_LLM_RESPONSE
    };
};