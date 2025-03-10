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
import Login from "./components/login/Login"

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
                <Route exact path="/" component={Home} />
                <Route exact path="/login" component={Login} />
                {/* <Route exact path="/about" component={About} />
                <Route path="*" component={NotFound}></Route> */}
              </Routes>
            </div>
            <Footer />
          </div>
        </Router>
      </Provider>
    )
  }
}
