import { combineReducers } from "redux";
import authReducer from "./authReducer";
import llmReducer from "./llmReducer";
import errorReducer from "./errorReducer";
import tripReducer from "./tripReducer";

export default combineReducers({
    auth: authReducer,
    llm: llmReducer,
    errors: errorReducer,
    trip: tripReducer
});