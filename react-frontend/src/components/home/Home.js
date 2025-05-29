import React, { useState, useEffect } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import './Home.css';

const Home = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { text: "Hi! I'm your travel assistant. How can I help you today?", isBot: true }
  ]);
  const [userMessage, setUserMessage] = useState('');

  const destinations = [
    {
      id: 1,
      title: 'Bali, Indonesia',
      subtitle: 'Tropical Paradise',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800'
    },
    {
      id: 2,
      title: 'Paris, France',
      subtitle: 'City of Love',
      image: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?auto=format&fit=crop&w=800'
    },
    {
      id: 3,
      title: 'Tokyo, Japan',
      subtitle: 'Vibrant Metropolis',
      image: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=800'
    },
    {
      id: 4,
      title: 'New York, USA',
      subtitle: 'The Big Apple',
      image: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=800'
    },
    {
      id: 5,
      title: 'Santorini, Greece',
      subtitle: 'Whitewashed Beauty',
      image: 'https://images.unsplash.com/photo-1519602035691-16ac091344ef?auto=format&fit=crop&w=800'
    },
    {
      id: 6,
      title: 'Sydney, Australia',
      subtitle: 'Harbor City',
      image: 'https://images.unsplash.com/photo-1523428096881-5bd79d043006?auto=format&fit=crop&w=800'
    }
  ];

  // Hero background images array
  const heroBackgrounds = [
    'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1920',
    'https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1920',
    'https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1920',
    'https://images.unsplash.com/photo-1470115636492-6d2b56f9146d?auto=format&fit=crop&w=1920',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920'
  ];

  // State for random background
  const [heroBackground, setHeroBackground] = useState('');

  // Set random background on component mount
  useEffect(() => {
    const randomImage = heroBackgrounds[Math.floor(Math.random() * heroBackgrounds.length)];
    setHeroBackground(randomImage);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    // In a real app, this would trigger a search
    alert(`Searching for: ${searchQuery}`);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!userMessage.trim()) return;
    
    // Add user message
    setChatMessages([...chatMessages, { text: userMessage, isBot: false }]);
    setUserMessage('');
    
    // Simulate bot response after a delay
    setTimeout(() => {
      setChatMessages(prev => [
        ...prev, 
        { text: "Thanks for your message! Our travel experts will help you plan your perfect trip.", isBot: true }
      ]);
    }, 1000);
  };

  return (
    <div className="travel-home">
      {/* Hero Section with Search */}
      <section 
          className="hero-section"
          style={{ 
          backgroundImage: heroBackground 
            ? `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${heroBackground})`
            : 'linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))'
        }}
      >
        <div className="hero-content">
          <h1>Discover Your Next Adventure</h1>
          <p>Explore the world's most beautiful destinations with us</p>
          
          <form onSubmit={handleSearch} className="search-bar">
            <input
              type="text"
              placeholder="Search destinations, hotels, activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">
              <i className="fas fa-search"></i> Search
            </button>
          </form>
          
          <div className="hero-tags">
            <span>Popular:</span>
            <a href="#">Beach</a>
            <a href="#">Mountain</a>
            <a href="#">City</a>
            <a href="#">Adventure</a>
          </div>
        </div>
      </section>

      {/* Featured Destinations */}
      <section className="featured-destinations">
        <h2>Featured Destinations</h2>
        <p>Explore our most popular travel spots</p>
        
        <div className="horizontal-scroll">
          {destinations.map((destination) => (
            <div key={destination.id} className="destination-card">
              <div className="card-image" style={{ backgroundImage: `url(${destination.image})` }}>
                <div className="card-overlay">
                  <h3>{destination.title}</h3>
                  <p>{destination.subtitle}</p>
                  <button className="explore-btn">Explore</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="why-choose-us">
        <h2>Why Choose Our Travel Services</h2>
        <div className="features-grid">
          <div className="feature">
            <i className="fas fa-globe"></i>
            <h3>Global Coverage</h3>
            <p>Access to thousands of destinations worldwide</p>
          </div>
          <div className="feature">
            <i className="fas fa-dollar-sign"></i>
            <h3>Best Prices</h3>
            <p>Price match guarantee on all bookings</p>
          </div>
          <div className="feature">
            <i className="fas fa-headset"></i>
            <h3>24/7 Support</h3>
            <p>Our travel experts are always available</p>
          </div>
          <div className="feature">
            <i className="fas fa-shield-alt"></i>
            <h3>Safe Travel</h3>
            <p>Your safety is our top priority</p>
          </div>
        </div>
      </section>

      {/* Travel Inspiration */}
      <section className="travel-inspiration">
        <h2>Get Inspired</h2>
        <p>Discover travel stories from our community</p>
        <div className="inspiration-grid">
          <div className="inspiration-card blog">
            <h3>Travel Blogs</h3>
            <p>Read stories from fellow travelers</p>
            <button>Explore Blogs</button>
          </div>
          <div className="inspiration-card tips">
            <h3>Travel Tips</h3>
            <p>Expert advice for your journey</p>
            <button>Get Tips</button>
          </div>
          <div className="inspiration-card deals">
            <h3>Hot Deals</h3>
            <p>Limited-time offers</p>
            <button>View Deals</button>
          </div>
        </div>
      </section>

      {/* Chat Assistant */}
      <div className={`chat-assistant ${isChatOpen ? 'open' : ''}`}>
        <button className="chat-toggle" onClick={() => setIsChatOpen(!isChatOpen)}>
          <i className="fas fa-comments"></i>
        </button>
        
        <div className="chat-container">
          <div className="chat-header">
            <h3>Travel Assistant</h3>
            <button onClick={() => setIsChatOpen(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <div className="chat-messages">
            {chatMessages.map((message, index) => (
              <div key={index} className={`message ${message.isBot ? 'bot' : 'user'}`}>
                {message.text}
              </div>
            ))}
          </div>
          
          <form onSubmit={handleSendMessage} className="chat-input">
            <input
              type="text"
              placeholder="Ask about destinations, hotels..."
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
            />
            <button type="submit">
              <i className="fas fa-paper-plane"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// map props to PropTypes for type checking
Home.propTypes = {
    auth: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    auth: state.auth
});

export default connect(
    mapStateToProps
)(Home);