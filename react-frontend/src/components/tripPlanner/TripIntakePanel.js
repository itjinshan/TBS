import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { sendIntakeMessage, updateTripBriefField, generateItinerary } from '../../actions/tripAction';
import AccommodationMap from './AccommodationMap';
import './TripIntakePanel.css';

const REQUIRED_FIELDS = ['destination', 'duration', 'numOfTravelers', 'budget', 'pace'];

const TripIntakePanel = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Built from t() (not a module-level const) so labels re-render when the
  // language changes. Keys are the JS-side field names used to read/write
  // tripBrief; values are the translated display labels.
  const FIELD_LABELS = {
    destination: t('intake.fields.destination'),
    duration: t('intake.fields.days'),
    numOfTravelers: t('intake.fields.numOfTravelers'),
    budget: t('intake.fields.budget'),
    pace: t('intake.fields.pace')
  };
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

  // Gated on the full intake stage machine reaching "ready" (see CLAUDE.md,
  // "Planned: Lodging Flow") rather than just these four chips, so the
  // accommodation step can't be skipped by generating early.
  const canGenerate = tripBrief.intakeStage === 'ready';

  // The map is a reveal, not always-on: it only mounts once there's an actual
  // candidate/suggestion list to show, alongside the matching chat prompt.
  const stage = tripBrief.intakeStage;
  const mapLocations = stage === 'accommodation_confirm'
    ? tripBrief.accommodationCandidates
    : stage === 'suggest_accommodation'
      ? tripBrief.accommodationSuggestions
      : null;
  const showMap = Array.isArray(mapLocations) && mapLocations.length > 0;

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
      const value = field === 'duration' || field === 'numOfTravelers' ? parseInt(rawValue, 10) : rawValue;
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

  // Tapping a marker picks it the same way typing its name in chat would —
  // it goes through the same pickFromList matching on the backend. Wrapped
  // in useCallback so AccommodationMap's marker effect (which depends on
  // this) doesn't rebuild markers on every keystroke-driven re-render.
  const handleLocationSelect = useCallback((location) => {
    if (isGenerating) return;
    dispatch(sendIntakeMessage(location.Name));
  }, [dispatch, isGenerating]);

  return (
    <div className={`trip-intake ${isOpen ? 'open' : ''} ${showMap ? 'with-map' : ''}`}>
      {!isOpen ? (
        <form onSubmit={handleSubmit} className="intake-collapsed">
          <input
            type="text"
            placeholder={t('intake.collapsedPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit">
            <i className="fas fa-paper-plane"></i> {t('intake.planMyTrip')}
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
                placeholder={t('intake.answerPlaceholder')}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isGenerating}
              />
              <button type="submit" disabled={isGenerating}>{t('intake.send')}</button>
            </form>
            {error && <p className="intake-error">{error.message || t('intake.errorFallback')}</p>}
          </div>

          {showMap && (
            <div className="intake-map">
              <AccommodationMap locations={mapLocations} onSelect={handleLocationSelect} />
            </div>
          )}

          <div className="trip-brief">
            <h4>{t('intake.tripBrief')}</h4>
            {REQUIRED_FIELDS.map((field) => (
              <div
                key={field}
                className={`brief-chip ${tripBrief[field] ? 'filled' : 'empty'}`}
                onClick={() => startEditing(field)}
              >
                <span className="chip-label">
                  {FIELD_LABELS[field]}
                  {field === 'pace' && (
                    <Tooltip
                      arrow
                      title={
                        <>
                          <div>{t('intake.paceOptions.explainRelaxed')}</div>
                          <div>{t('intake.paceOptions.explainStandard')}</div>
                          <div>{t('intake.paceOptions.explainPacked')}</div>
                        </>
                      }
                    >
                      <InfoOutlinedIcon
                        className="chip-info-icon"
                        fontSize="inherit"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Tooltip>
                  )}
                </span>
                {editingField === field ? (
                  field === 'budget' ? (
                    <select
                      autoFocus
                      value={editingValue}
                      onChange={(e) => commitValue(field, e.target.value)}
                      onBlur={() => setEditingField(null)}
                    >
                      <option value="">{t('intake.budgetOptions.select')}</option>
                      <option value="budget">{t('intake.budgetOptions.budget')}</option>
                      <option value="mid-range">{t('intake.budgetOptions.midRange')}</option>
                      <option value="luxury">{t('intake.budgetOptions.luxury')}</option>
                    </select>
                  ) : field === 'pace' ? (
                    <select
                      autoFocus
                      value={editingValue}
                      onChange={(e) => commitValue(field, e.target.value)}
                      onBlur={() => setEditingField(null)}
                    >
                      <option value="">{t('intake.paceOptions.select')}</option>
                      <option value="relaxed">{t('intake.paceOptions.relaxed')}</option>
                      <option value="standard">{t('intake.paceOptions.standard')}</option>
                      <option value="packed">{t('intake.paceOptions.packed')}</option>
                    </select>
                  ) : (
                    <input
                      autoFocus
                      type={field === 'duration' || field === 'numOfTravelers' ? 'number' : 'text'}
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={() => commitValue(field, editingValue)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitValue(field, editingValue); }}
                    />
                  )
                ) : (
                  <span className="chip-value">{tripBrief[field] || t('intake.notSetYet')}</span>
                )}
              </div>
            ))}
            <button
              type="button"
              className="generate-btn"
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerate}
            >
              {isGenerating ? t('intake.generating') : t('intake.generateItinerary')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripIntakePanel;
