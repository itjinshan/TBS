import React, { Component } from 'react'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import './App.css';
import PrivateRoute from "./utils/PrivateRoute";

import NavBar from "./components/layout/Navbar"
import Footer from "./components/layout/Footer"

// routes
//

// Basics
import Home from "./components/home/Home"
// Auth
import Login from "./components/auth/Login"
import Register from "./components/auth/Register"
import ForgetPassword from "./components/auth/ForgotPassword"
import ResetPassword from "./components/auth/ResetPassword"
import CreatePassword from "./components/auth/CreatePassword"

// Redux provider
//
import { Provider } from "react-redux";
import { store } from "./store";


// App class
//
export default class App extends Component {
  render(){
    return(
      <Provider store = {store}>
        <Router> 
          <div className = "App">
            <NavBar />
            <div style={{minHeight:window.innerHeight-250, marginTop:"97px"}}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forget-password" element={<ForgetPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/create-password" element={<CreatePassword />} />
              </Routes>
            </div>
            <Footer />
            </div>
        </Router>
      </Provider>
    )
  }
}
