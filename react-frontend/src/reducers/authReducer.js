import {
    SET_CURRENT_USER,
    PROFILE_LOADING,
    AUTH_ERRORS,
    FORGET_STATUS,
    RESET_STATUS,
    CREATE_STATUS,
    RESET_FORGET_STATUS,
    RESET_RESET_STATUS,
    RESET_CREATE_STATUS,
    REGISTER_PENDING_VERIFICATION,
    RESET_REGISTER_PENDING,
    VERIFY_STATUS,
    RESET_VERIFY_STATUS,
    RESEND_VERIFICATION_STATUS,
    RESET_RESEND_VERIFICATION_STATUS
   } from "../actions/types";
  import isEmpty from "../utils/isEmpty";

    const initialState = {
      accessExpired: false,
      isAuthenticated: false,
      fetchingCurrent: false,
      isUpdated: false,
      forgetStatusMSG:"",
      resetStatusMSG:"",
      createStatusMSG:"",
      resetStatus: false,
      forgetStatus: false,
      createStatus: false,
      user: {},
      registrationPending: false,
      registrationMessage: "",
      verifyStatus: null,
      verifyStatusCode: "",
      verifyStatusMSG: "",
      resendStatus: null,
      resendStatusMSG: "",
    };
    
    // ...state = current state
    // if payload is empty 'isAuthenticated' is false
    export default function(state = initialState, action) {
      switch (action.type) {
        case PROFILE_LOADING:
          return {
            ...state,
            fetchingCurrent: true,
            isAuthenticated: true
          };
        case SET_CURRENT_USER:
          return {
            ...state,
            isAuthenticated: !isEmpty(action.payload),
            fetchingCurrent: false,
            user: action.payload
          };
        case FORGET_STATUS:
          return{
            ...state,
            isUpdated: true,
            forgetStatus: action.payload.forgetStatus,
            forgetStatusMSG: action.payload.statusmsg
          }
        case RESET_STATUS:
          return {
            ...state,
            isUpdated: true,
            resetStatus: action.payload.resetStatus,
            resetStatusMSG: action.payload.statusmsg
          }
        case CREATE_STATUS:
          return {
            ...state,
            isUpdated: true,
            createStatus: action.payload.createStatus,
            createStatusMSG: action.payload.statusmsg
          }
        case AUTH_ERRORS:
          return{
            ...state,
            fetchingCurrent: false,
            isAuthenticated: false,
            accessExpired: true,
          }
        case RESET_FORGET_STATUS:
          return{
            ...state,
            isUpdated: false,
            forgetStatus: false,
            forgetStatusMSG: ""
          }
        case RESET_RESET_STATUS:
          return{
            ...state,
            isUpdated: false,
            resetStatus: false,
            resetStatusMSG: ""
          }
        case RESET_CREATE_STATUS:
          return {
            ...state,
            isUpdated: false,
            createStatus: initialState.createStatus,
            createStatusMSG: initialState.createStatusMSG
          }
        case REGISTER_PENDING_VERIFICATION:
          return {
            ...state,
            registrationPending: true,
            registrationMessage: action.payload
          }
        case RESET_REGISTER_PENDING:
          return {
            ...state,
            registrationPending: false,
            registrationMessage: ""
          }
        case VERIFY_STATUS:
          return {
            ...state,
            verifyStatus: action.payload.verifyStatus,
            verifyStatusCode: action.payload.verifyStatusCode,
            verifyStatusMSG: action.payload.statusmsg
          }
        case RESET_VERIFY_STATUS:
          return {
            ...state,
            verifyStatus: initialState.verifyStatus,
            verifyStatusCode: initialState.verifyStatusCode,
            verifyStatusMSG: initialState.verifyStatusMSG
          }
        case RESEND_VERIFICATION_STATUS:
          return {
            ...state,
            resendStatus: action.payload.resendStatus,
            resendStatusMSG: action.payload.statusmsg
          }
        case RESET_RESEND_VERIFICATION_STATUS:
          return {
            ...state,
            resendStatus: initialState.resendStatus,
            resendStatusMSG: initialState.resendStatusMSG
          }
        default:
          return state;
      }
    }