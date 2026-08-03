import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './i18n';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { store } from './store';
import { logoutUser } from './actions/authAction';
import setupAxiosInterceptors from './utils/axiosInterceptors';

// If the RefreshToken is missing/expired too, log the user out client-side
// instead of leaving them stuck re-hitting a 401 on every request.
setupAxiosInterceptors(() => store.dispatch(logoutUser()));

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
