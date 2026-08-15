import React, { Component } from 'react'
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
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
import VerifyEmail from "./components/auth/VerifyEmail"

//Itinerary
import Itinerary from "./components/itinerary/Itinerary"

// Profile
import ProfilePage from "./components/profile/ProfilePage"


// Redux provider
//
import { Provider } from "react-redux";
import { store } from "./store";

// Superseded by the docked ItineraryChatPanel on the Itinerary page — avoid
// two overlapping chat entry points (the floating "Need help?" bubble sits
// bottom-right, same corner a right-docked chat panel would occupy) on the
// same page. See components/itinerary/ItineraryChatPanel.js.
const GlobalLLMChatBot = () => {
  const location = useLocation();
  if (location.pathname === '/itinerary') return null;
  return <LLMChatBot />;
};

// Itinerary.js renders a fixed-viewport, non-scrolling app view
// (`.itinerary-page`, height: calc(100vh - navbar height) — see
// Itinerary.css) with its own internal scroll regions (day list, map, chat
// panel). Footer is marketing-page chrome with no purpose there, and its
// extra height was previously pushing the whole page taller than the
// viewport, forcing the ENTIRE page to scroll — including the chat panel's
// input, which is otherwise correctly pinned to the bottom of its own
// column — rather than staying fixed at the bottom of the window (see
// CLAUDE.md's resolved chat-input-scroll bug for the full diagnosis).
const GlobalFooter = () => {
  const location = useLocation();
  if (location.pathname === '/itinerary') return null;
  return <Footer />;
};


// App class
//
export default class App extends Component {
  render(){
    return(
      <Provider store = {store}>
        <Router> 
          <div>
            <NavBar />
            <div>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/create-password" element={<CreatePassword />} />
                {/* Home renders underneath so the verification dialog overlays
                    the homepage's hero background, matching how Login/Register
                    look when opened from "/", instead of a bare page. */}
                <Route path="/verify-email" element={<><Home /><VerifyEmail /></>} />
                <Route path="/itinerary" element={<Itinerary />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Routes>
            </div>
            <GlobalFooter />
            <GlobalLLMChatBot />
            </div>
        </Router>
      </Provider>
    )
  }
}
