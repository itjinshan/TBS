import axios from "axios";
import setAuthToken from "./setAuthToken";

// Catches a 401 (expired AccessToken), redeems the stored RefreshToken for a
// fresh pair via POST /jwt/refresh, and retries the original request once.
// Concurrent 401s while a refresh is already in flight queue behind it
// instead of each firing their own refresh call.
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

const setupAxiosInterceptors = onRefreshFailure => {
  axios.interceptors.response.use(
    response => response,
    error => {
      const originalRequest = error.config;
      const status = error.response ? error.response.status : null;

      if (
        status !== 401 ||
        !originalRequest ||
        originalRequest._retry ||
        (originalRequest.url && originalRequest.url.includes("/jwt/refresh"))
      ) {
        return Promise.reject(error);
      }

      const RefreshToken = localStorage.getItem("RefreshToken");
      if (!RefreshToken) {
        onRefreshFailure();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(AccessToken => {
          originalRequest.headers["Authorization"] = AccessToken;
          return axios(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return axios
        .post("/jwt/refresh", { RefreshToken })
        .then(res => {
          const { AccessToken, RefreshToken: NewRefreshToken } = res.data;
          localStorage.setItem("AccessToken", AccessToken);
          localStorage.setItem("RefreshToken", NewRefreshToken);
          setAuthToken(AccessToken);
          processQueue(null, AccessToken);
          originalRequest.headers["Authorization"] = AccessToken;
          return axios(originalRequest);
        })
        .catch(refreshErr => {
          processQueue(refreshErr, null);
          onRefreshFailure();
          return Promise.reject(refreshErr);
        })
        .finally(() => {
          isRefreshing = false;
        });
    }
  );
};

export default setupAxiosInterceptors;
