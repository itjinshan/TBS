// General Error
//
export const GET_ERRORS = "GET_ERRORS";
export const RESET_ERRORS = "RESET_ERRORS";

// AUTH
//
export const AUTH_ERRORS = "AUTH_ERRORS";
export const SET_CURRENT_USER = "SET_CURRENT_USER";
export const GET_PROFILE = "GET_PROFILE";
export const FORGET_STATUS = "FORGET_STATUS";
export const CREATE_STATUS = "CREATE_STATUS";
export const RESET_CREATE_STATUS = "RESET_CREATE_STATUS";
export const RESET_FORGET_STATUS = "RESET_FORGET_STATUS";
export const RESET_STATUS = "RESET_STATUS";
export const RESET_RESET_STATUS = "RESET_RESET_STATUS";
export const REGISTER_PENDING_VERIFICATION = "REGISTER_PENDING_VERIFICATION";
export const RESET_REGISTER_PENDING = "RESET_REGISTER_PENDING";
export const VERIFY_STATUS = "VERIFY_STATUS";
export const RESET_VERIFY_STATUS = "RESET_VERIFY_STATUS";
export const RESEND_VERIFICATION_STATUS = "RESEND_VERIFICATION_STATUS";
export const RESET_RESEND_VERIFICATION_STATUS = "RESET_RESEND_VERIFICATION_STATUS";

// PROFILE
export const GET_PROFILE_INFO = "GET_PROFILE_INFO";
export const PROFILE_LOADING = "PROFILE_LOADING";
export const CLEAR_CURRENT_PROFILE = "CLEAR_CURRENT_PROFILE";

export const SET_CURRENT_PERSONAL = "SET_CURRENT_PERSONAL";
export const PERSONAL_UPDATING_STATUS = "PERSONAL_UPDATING_STATUS";
export const RESET_PERSONAL_UPDATING_STATUS = "RESET_PERSONAL_UPDATING_STATUS";
export const OVERIDE_GREENLIGHT = "OVERIDE_GREENLIGHT";
export const OVERIDE_REDLIGHT = "OVERIDE_REDLIGHT";

// LLMCHATBOT
// DEEPSEEK
export const SET_LLM_RESPONSE = "SET_LLM_RESPONSE";
export const RESET_LLM_RESPONSE = "RESET_LLM_RESPONSE";
export const LLM_ERRORS = "LLM_ERRORS";

// TRIP INTAKE / ITINERARY
export const ADD_TRIP_MESSAGE = "ADD_TRIP_MESSAGE";
export const MERGE_TRIP_BRIEF = "MERGE_TRIP_BRIEF";
export const SET_ITINERARY_LOADING = "SET_ITINERARY_LOADING";
export const SET_ITINERARY = "SET_ITINERARY";
export const TRIP_ERRORS = "TRIP_ERRORS";
export const RESET_TRIP = "RESET_TRIP";

// Auto-save (see tripAction.js's autoSaveTrip()) — no manual "Save Trip"
// button anymore; every itinerary change is persisted in the background.
export const SET_ITINERARY_ID = "SET_ITINERARY_ID";
export const SET_TRIP_SAVING = "SET_TRIP_SAVING";
export const TRIP_SAVE_ERROR = "TRIP_SAVE_ERROR";

// ITINERARY-PAGE REFINEMENT CHAT — a separate conversation/stage machine
// from trip intake above, so it gets its own message list/loading/error
// fields rather than reusing ADD_TRIP_MESSAGE/SET_ITINERARY_LOADING/
// TRIP_ERRORS (which would interleave the two conversations if the user
// ever navigated back to `/` mid-refinement).
export const ADD_REFINEMENT_MESSAGE = "ADD_REFINEMENT_MESSAGE";
export const SET_REFINEMENT_STAGE = "SET_REFINEMENT_STAGE";
export const SET_REFINEMENT_LOADING = "SET_REFINEMENT_LOADING";
export const REFINEMENT_ERRORS = "REFINEMENT_ERRORS";
export const RESET_REFINEMENT = "RESET_REFINEMENT";
export const UPDATE_ITINERARY = "UPDATE_ITINERARY";
export const SET_ACCOMMODATION_CANDIDATES = "SET_ACCOMMODATION_CANDIDATES";

// PROFILE PAGE — trip history (GET /trip/mine), separate from the
// itinerary-in-progress state above since it's an unrelated list, not "the"
// itinerary.
export const SET_MY_TRIPS_LOADING = "SET_MY_TRIPS_LOADING";
export const SET_MY_TRIPS = "SET_MY_TRIPS";
export const MY_TRIPS_ERRORS = "MY_TRIPS_ERRORS";