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

// LLMChatBot
import LLMChatBot from "./components/llmChat/LLMChatBot"

// Auth
import ResetPassword from "./components/auth/ResetPassword"
import CreatePassword from "./components/auth/CreatePassword"

//Itinerary
import Itinerary from "./components/itinerary/Itinerary"


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
            <div>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/create-password" element={<CreatePassword />} />
                <Route path="/itinerary" element={<Itinerary />} />
              </Routes>
            </div>
            <Footer />
            <LLMChatBot />
            </div>
        </Router>
      </Provider>
    )
  }
}
