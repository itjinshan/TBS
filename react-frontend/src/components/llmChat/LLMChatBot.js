import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch, connect } from "react-redux";
import PropTypes from "prop-types";
import { getLLMChat, resetLLMResponse } from "../../actions/dsAction";
import './LLMChatBot.css';

const LLMChatBot = () => {
  const dispatch = useDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I can help you generate travel itineraries. How can I assist you today?",
      sender: 'bot'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const { hasNewResponse, llmResponse, llmError, llmErrorMessage } = useSelector((state) => state.llm);

  useEffect(() => {
    if (hasNewResponse) {
      const botMessage = {
        id: messages.length + 1,
        text: llmResponse.data?.content ? llmResponse.data.content : "Sorry, I couldn't process your request. Please try again.",
        sender: 'bot'
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
      dispatch(resetLLMResponse());
    }
  }, [hasNewResponse, llmResponse, llmError, llmErrorMessage, messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: inputValue,
      sender: 'user'
    };
    const userQuery = {
      id: messages.length + 1,
      query: inputValue
    };
    dispatch(getLLMChat(userQuery));
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (chatContainerRef.current && !chatContainerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`floating-chat-container ${isOpen ? 'open' : ''}`} ref={chatContainerRef}>
      {isOpen ? (
        <div className="chat-box">
          <div className="chat-header">
            <h3>Travel Assistant</h3>
            <button className="close-chat" onClick={toggleChat}>×</button>
          </div>
          
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.sender}`}>
                <div className="message-content">
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            {isLoading && (
              <div className="message bot">
                <div className="message-content typing">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading}>
              Send
            </button>
          </form>
        </div>
      ) : (
        <button className="chat-button" onClick={toggleChat}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      )}
    </div>
  );
};

export default LLMChatBot;