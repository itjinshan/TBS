import { applyMiddleware, compose } from "redux";
import { configureStore } from "@reduxjs/toolkit";
import { thunk } from "redux-thunk";
import rootReducer from "./reducers"; // import reducers which is a function
const initialState = {};

const middleware = [thunk];

const store = configureStore(
    { reducer: rootReducer },
    initialState,
    compose(
        applyMiddleware(...middleware),
    )
);

export { store };