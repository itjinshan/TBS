import { 
    AUTH_ERRORS, 
    SET_CURRENT_USER, 
    GET_PROFILE_INFO,
    PROFILE_LOADING,
    FORGET_STATUS,
    RESET_STATUS,
    CREATE_STATUS,
    RESET_CREATE_STATUS,
    RESET_FORGET_STATUS,
    RESET_RESET_STATUS,
    GET_ERRORS,
    RESET_ERRORS
     } from "./types";
import axios from "axios";
import setAuthToken from "../utils/setAuthToken";
import { jwtDecode } from "jwt-decode";

// Registration
//
export const registerUser = (userData) => dispatch => {
    axios
        .post("/auth/register", userData)
        .then(res => {
            const { AccessToken, RefreshToken, Email } = res.data;
            localStorage.setItem("AccessToken", AccessToken);
            localStorage.setItem("RefreshToken", RefreshToken);
            setAuthToken(AccessToken);
            const decoded = jwtDecode(AccessToken);
            let credentialDecoded = {
                UserID: decoded.UserID,
                Email: Email,
                FirstName: decoded.FirstName,
                LastName: decoded.LastName,
            };

            dispatch(setCurrentUser(credentialDecoded));
        })
        .catch(err => {
            dispatch({
                type: AUTH_ERRORS,
            });
            dispatch({
                type: GET_ERRORS,
                payload: err.response ? err.response.data : { message: "An error occurred" }
            });
        }
        );
};

// Login - get user token
// 
export const loginUser = userData => dispatch => {
    axios
        .post("/auth/login", userData)
        .then(res => {
            const{ AccessToken, RefreshToken, Email } = res.data;
            localStorage.setItem("AccessToken", AccessToken);
            localStorage.setItem("RefreshToken", RefreshToken);
            setAuthToken(AccessToken);
            const decoded = jwtDecode(AccessToken);
            let credentialDecoded = {
                UserID: decoded.UserID,
                Email: Email,
                FirstName: decoded.FirstName,
                LastName: decoded.LastName,
            };

            dispatch(setCurrentUser(credentialDecoded));
        })
        .catch(err => {
            dispatch({
                type: AUTH_ERRORS
            });
            dispatch({
                type: GET_ERRORS,
                payload: err.response.data
            });
        });
};

// Get User's email and firstname
export const getProfileInfo = () => dispatch => {
    dispatch(setProfileLoading());
    axios
      .get("/auth/current")
      .then(res => {
        const { AccessToken, RefreshToken, Email, FirstName, LastName, Phone, UserID } = res.data;
        localStorage.setItem("AccessToken", AccessToken);
        localStorage.setItem("RefreshToken", RefreshToken);
        setAuthToken(AccessToken);
        let decoded = {
            Email: Email,
            FirstName: FirstName,
            LastName: LastName,
            Phone: Phone,
            UserID: UserID
        }
        dispatch(setCurrentUser(decoded));
      })
      .catch(err => {
        dispatch({
            type: AUTH_ERRORS
        });
        dispatch({
            type: GET_ERRORS,
            payload: err.response.data
        });
      });
};

// Forgot password
export const forgotPassword = userEmail => dispatch => {
    axios
      .put("/auth/forgot-password", userEmail)
      .then(res => {
        let forgetStatus = {
            forgetStatus: res.data.forgetStatus,
            statusmsg: res.data.statusmsg
        }
        dispatch({
            type: FORGET_STATUS,
            payload: forgetStatus
        })
      })
      .catch(err => {
        dispatch({
            type: AUTH_ERRORS
        });
        dispatch({
            type: GET_ERRORS,
            payload: err.response.data
        });
      });
}

// Reset Password
export const resetPassword = newCredential => dispatch => {
    axios
      .put("auth/reset-password", newCredential)
      .then(res =>{
        let reset = {
            resetStatus: res.data.resetStatus,
            statusmsg: res.data.statusmsg
        }
        dispatch({
            type: RESET_STATUS,
            payload: reset
        })
        
      })
      .catch(err => {
        dispatch({
            type: AUTH_ERRORS
        });
        dispatch({
            type: GET_ERRORS,
            payload: err.response.data
        });
    });
}

// Create Password
export const createPassword = newCredential => dispatch => {
    axios
      .put("auth/create-password", newCredential)
      .then(res =>{
        let create = {
            createStatus: res.data.createStatus,
            statusmsg: res.data.statusmsg
        }
        dispatch({
            type: CREATE_STATUS,
            payload: create
        })
      })
      .catch(err => {
        dispatch({
            type: AUTH_ERRORS
        });
        dispatch({
            type: GET_ERRORS,
            payload: err.response.data
        });
    });
}

// Profile loading
export const setProfileLoading = () => {
    return {
      type: PROFILE_LOADING
    };
};

// Reset Forget Status
export const resetForgetStatus = () => {
    return {
        type: RESET_FORGET_STATUS
    };
};

// Reset Reset Status
export const resetResetStatus = () => {
    return {
        type: RESET_RESET_STATUS
    }
}

// Reset Create Status
export const resetCreateStatus = () => {
    return {
        type: RESET_CREATE_STATUS
    }
}

// Set logged in user
//
export const setCurrentUser = decoded => {
    return{
        type: SET_CURRENT_USER,
        payload: decoded
    };
};

// Log user out
//
export const logoutUser = () => dispatch => {
    localStorage.clear();
    setAuthToken(false);
    dispatch(setCurrentUser({}));
};

export const resetErrors = status => {
    return {
        type : RESET_ERRORS,
    };
};