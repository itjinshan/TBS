import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { sendIntakeMessage, updateTripBriefField, generateItinerary } from '../../actions/tripAction';
import AccommodationMap from './AccommodationMap';
import './TripIntakePanel.css';

const REQUIRED_FIELDS = ['destination', 'duration', 'numOfTravelers', 'budget', 'pace', 'transportMode', 'arrivalPoint', 'departurePoint'];

// Unlike the other chips, these resolve to a real-world place object
// ({ Name, Address, Latitude, Longitude }, see Node/APIs/trip.js's
// resolvePlacePoint) rather than a plain string — shown read-only (by
// name) rather than editable inline, same as accommodation elsewhere in
// this flow, since there's no simple text-input equivalent that wouldn't
// just overwrite the resolved coordinates with an unverified string.
const PLACE_POINT_FIELDS = ['arrivalPoint', 'departurePoint'];

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
    pace: t('intake.fields.pace'),
    transportMode: t('intake.fields.transportMode'),
    arrivalPoint: t('intake.fields.arrivalPoint'),
    departurePoint: t('intake.fields.departurePoint')
  };
  const { tripBrief, messages, isGenerating, error } = useSelector((state) => state.trip);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const messagesContainerRef = useRef(null);

  // Sets .intake-messages's own scrollTop directly rather than
  // messagesEndRef.scrollIntoView() — scrollIntoView() walks up every
  // scrollable ancestor to bring its target into view, including the
  // whole document once the panel (especially with the accommodation map
  // open) is taller than the viewport, dragging the entire page down on
  // every message instead of just the chat log. Setting scrollTop touches
  // only this container.
  useEffect(() => {
    if (isOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Gated on the full intake stage machine reaching "ready" (see CLAUDE.md,
  // "Planned: Lodging Flow") rather than just these four chips, so the
  // accommodation step can't be skipped by generating early.
  const canGenerate = tripBrief.intakeStage === 'ready';

  // The map is a reveal, not always-on: it only mounts once there's an actual
  // candidate list to show, alongside the matching chat prompt.
  // (suggest_accommodation no longer occurs — see CLAUDE.md's resolved
  // accommodation-timing bug; hotel suggestion now happens post-generation
  // on the Itinerary page instead.)
  const stage = tripBrief.intakeStage;
  const mapLocations = stage === 'accommodation_confirm' ? tripBrief.accommodationCandidates : null;
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
            <div className="intake-messages" ref={messagesContainerRef}>
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.sender}`}>
                  <div className="message-content">{m.text}</div>
                </div>
              ))}
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
                className={`brief-chip ${tripBrief[field] ? 'filled' : 'empty'} ${PLACE_POINT_FIELDS.includes(field) ? 'read-only' : ''}`}
                onClick={() => { if (!PLACE_POINT_FIELDS.includes(field)) startEditing(field); }}
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
                  ) : field === 'transportMode' ? (
                    <select
                      autoFocus
                      value={editingValue}
                      onChange={(e) => commitValue(field, e.target.value)}
                      onBlur={() => setEditingField(null)}
                    >
                      <option value="">{t('intake.transportModeOptions.select')}</option>
                      <option value="walking">{t('intake.transportModeOptions.walking')}</option>
                      <option value="public_transit">{t('intake.transportModeOptions.publicTransit')}</option>
                      <option value="taxi">{t('intake.transportModeOptions.taxi')}</option>
                      <option value="driving">{t('intake.transportModeOptions.driving')}</option>
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
                  <span className="chip-value">
                    {PLACE_POINT_FIELDS.includes(field)
                      ? (tripBrief[field]?.Name || t('intake.notSetYet'))
                      : (tripBrief[field] || t('intake.notSetYet'))}
                  </span>
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
