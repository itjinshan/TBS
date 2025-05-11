import React, { useState, useRef, useEffect } from 'react';
import './ItineraryChatGen.css'; // We'll create this CSS file next

const ItineraryChatGen = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I can help you generate travel itineraries based on your images. Where would you like to go?",
      sender: 'bot'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null); // New ref for the messages container

  const scrollToBottom = () => {
    // Only scroll the chat messages container, not the parent
    if (chatMessagesRef.current && messagesEndRef.current) {
      chatMessagesRef.current.scrollTo({
        top: messagesEndRef.current.offsetTop,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user'
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Simulate bot response after a delay
    setTimeout(() => {
      const botResponses = [
        "That sounds like a great destination! What kind of activities are you interested in?",
        "I can suggest some amazing places there. Are you looking for adventure or relaxation?",
        "Wonderful choice! How many days will you be staying?",
        "I have some great recommendations for that location. What's your budget range?",
        "That place is beautiful! Are you traveling alone or with others?"
      ];
      const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
      
      const botMessage = {
        id: messages.length + 2,
        text: randomResponse,
        sender: 'bot'
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
  };

  return (
    <div className="itinerary-chat-container">
      <div className="chat-header">
        <h3>Travel Itinerary Assistant</h3>
        <div className="chat-status">
          {isLoading ? (
            <span className="typing-indicator">Assistant is typing...</span>
          ) : (
            <span className="online-indicator">Online</span>
          )}
        </div>
      </div>
      
      <div className="chat-messages" ref={chatMessagesRef}>
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.sender}`}
          >
            <div className="message-content">
              {message.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSendMessage} className="chat-input-form">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about your travel plans..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default ItineraryChatGen;