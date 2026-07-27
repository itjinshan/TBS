import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sendIntakeMessage, updateTripBriefField, generateItinerary } from '../../actions/tripAction';
import './TripIntakePanel.css';

const REQUIRED_FIELDS = ['destination', 'duration', 'travelers', 'budget'];

const FIELD_LABELS = {
  destination: 'Destination',
  duration: 'Days',
  travelers: 'Travelers',
  budget: 'Budget'
};

const TripIntakePanel = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { tripBrief, messages, isGenerating, error } = useSelector((state) => state.trip);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const missingRequired = REQUIRED_FIELDS.filter(
    (field) => tripBrief[field] === undefined || tripBrief[field] === null || tripBrief[field] === ''
  );
  const canGenerate = missingRequired.length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    if (!isOpen) setIsOpen(true);
    dispatch(sendIntakeMessage(inputValue.trim()));
    setInputValue('');
  };

  const startEditing = (field) => {
    setEditingField(field);
    setEditingValue(tripBrief[field] != null ? String(tripBrief[field]) : '');
  };

  const commitValue = (field, rawValue) => {
    if (rawValue !== '' && rawValue !== undefined) {
      const value = field === 'duration' || field === 'travelers' ? parseInt(rawValue, 10) : rawValue;
      if (value !== undefined && !Number.isNaN(value)) {
        dispatch(updateTripBriefField(field, value));
      }
    }
    setEditingField(null);
    setEditingValue('');
  };

  const handleGenerate = () => {
    dispatch(generateItinerary())
      .then(() => navigate('/itinerary'))
      .catch(() => {});
  };

  return (
    <div className={`trip-intake ${isOpen ? 'open' : ''}`}>
      {!isOpen ? (
        <form onSubmit={handleSubmit} className="intake-collapsed">
          <input
            type="text"
            placeholder="Tell us about your dream trip…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit">
            <i className="fas fa-paper-plane"></i> Plan my trip
          </button>
        </form>
      ) : (
        <div className="intake-panel">
          <button type="button" className="intake-close" onClick={() => setIsOpen(false)}>×</button>

          <div className="intake-chat">
            <div className="intake-messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.sender}`}>
                  <div className="message-content">{m.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="intake-input-form">
              <input
                type="text"
                placeholder="Type your answer…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isGenerating}
              />
              <button type="submit" disabled={isGenerating}>Send</button>
            </form>
            {error && <p className="intake-error">{error.message || 'Something went wrong. Please try again.'}</p>}
          </div>

          <div className="trip-brief">
            <h4>Trip Brief</h4>
            {REQUIRED_FIELDS.map((field) => (
              <div
                key={field}
                className={`brief-chip ${tripBrief[field] ? 'filled' : 'empty'}`}
                onClick={() => startEditing(field)}
              >
                <span className="chip-label">{FIELD_LABELS[field]}</span>
                {editingField === field ? (
                  field === 'budget' ? (
                    <select
                      autoFocus
                      value={editingValue}
                      onChange={(e) => commitValue(field, e.target.value)}
                      onBlur={() => setEditingField(null)}
                    >
                      <option value="">Select…</option>
                      <option value="budget">Budget</option>
                      <option value="mid-range">Mid-range</option>
                      <option value="luxury">Luxury</option>
                    </select>
                  ) : (
                    <input
                      autoFocus
                      type={field === 'duration' || field === 'travelers' ? 'number' : 'text'}
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => commitValue(field, editingValue)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitValue(field, editingValue); }}
                    />
                  )
                ) : (
                  <span className="chip-value">{tripBrief[field] || 'Not set yet'}</span>
                )}
              </div>
            ))}
            <button
              type="button"
              className="generate-btn"
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerate}
            >
              {isGenerating ? 'Generating…' : 'Generate Itinerary'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripIntakePanel;
