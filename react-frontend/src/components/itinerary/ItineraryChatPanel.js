import React, { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { sendRefinementMessage, startRefinementConversation } from '../../actions/tripAction';
import './ItineraryChatPanel.css';

// Persistent chat panel for the Itinerary page — a dedicated, always-visible
// column (open by default), not a floating help bubble. Reuses
// TripIntakePanel.js's message-list/input-form/auto-scroll pattern under
// its own `itin-chat-*` class names (kept separate rather than shared,
// since TBS has no CSS Modules and the two chat surfaces are independent
// components with independent styling needs).
const ItineraryChatPanel = ({ open, onToggle }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { refinementMessages, isRefining, refinementError } = useSelector((state) => state.trip);
  const [inputValue, setInputValue] = useState('');
  const messagesRef = useRef(null);

  // Opens the confirm-then-modify conversation once, the first time this
  // panel mounts with nothing in it yet — a static local message, no
  // backend round-trip.
  useEffect(() => {
    if (refinementMessages.length === 0) {
      dispatch(startRefinementConversation());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same scrollTop-direct technique as TripIntakePanel.js, not
  // scrollIntoView() — keeps the scroll confined to this panel's own
  // message log instead of dragging the whole page.
  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [refinementMessages, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isRefining) return;
    dispatch(sendRefinementMessage(inputValue.trim()));
    setInputValue('');
  };

  return (
    <div className={`itin-chat-panel ${open ? 'open' : 'collapsed'}`}>
      <button type="button" className="itin-chat-toggle" onClick={onToggle} aria-label={t('itinerary.chat.toggle')}>
        {open ? '›' : '💬'}
      </button>
      {open && (
        <div className="itin-chat-body">
          <h4 className="itin-chat-title">{t('itinerary.chat.title')}</h4>
          <div className="itin-chat-messages" ref={messagesRef}>
            {refinementMessages.map((m) => (
              <div key={m.id} className={`itin-chat-message ${m.sender}`}>
                <div className="itin-chat-message-content">{m.text}</div>
              </div>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="itin-chat-input-form">
            <input
              type="text"
              placeholder={t('itinerary.chat.answerPlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isRefining}
            />
            <button type="submit" disabled={isRefining}>{t('itinerary.chat.send')}</button>
          </form>
          {refinementError && <p className="itin-chat-error">{refinementError.message || t('itinerary.chat.errorFallback')}</p>}
        </div>
      )}
    </div>
  );
};

export default ItineraryChatPanel;
