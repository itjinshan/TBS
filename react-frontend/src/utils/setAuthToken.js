import axios from "axios";

const setAuthToken = AccessToken => {
  if (AccessToken) {
    // Apply auth token to every request
    axios.defaults.headers.common["Authorization"] = AccessToken;
  } else {
    // Delete auth header
    delete axios.defaults.headers.common["Authorization"];
  }
};

export default setAuthToken;