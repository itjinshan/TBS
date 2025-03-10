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
    ALL_ADMINS,
    ADD_ADMIN_STATUS,
    RESET_ADD_ADMIN_STATUS
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
  
      // admins
      adminCreated: false,
      admins: []
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
        case ALL_ADMINS:
          return{
            ...state,
            admins: action.payload
          };
        case ADD_ADMIN_STATUS:
          return{
            ...state,
            isUpdated: true,
            adminsCreated: action.payload.adminCreated
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
        case RESET_ADD_ADMIN_STATUS:
          return{
            ...state,
            isUpdated: false,
            adminCreated: initialState.adminCreated
          }
        default:
          return state;
      }
    }