import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../actions/authAction';
import { getMyTrips, loadTripById } from '../../actions/tripAction';
import './ProfilePage.css';

// Wanderlog-style layout: editable identity info, then a trip-history list
// split into upcoming/past (see CLAUDE.md's "Pending Tasks", "Build a
// profile management page"). Reachable from Navbar.js's "My Profile"
// dropdown item.
const ProfilePage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { myTrips, myTripsLoading, myTripsError } = useSelector((state) => state.trip);

  const [form, setForm] = useState({ FirstName: '', LastName: '', Phone: '' });
  const [formErrors, setFormErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [loadingTripId, setLoadingTripId] = useState(null);

  useEffect(() => {
    if (isAuthenticated) dispatch(getMyTrips());
  }, [isAuthenticated, dispatch]);

  // Syncs whenever `user` changes, not just on mount — Navbar.js's own mount
  // effect is what actually fetches the profile (getProfileInfo()), so this
  // page can render before that resolves.
  useEffect(() => {
    setForm({
      FirstName: user?.FirstName || '',
      LastName: user?.LastName || '',
      Phone: user?.Phone || ''
    });
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Editing again after a save/error clears the stale status/error rather
    // than leaving a "Saved"/error label sitting on an already-changed form.
    if (saveStatus !== 'idle') setSaveStatus('idle');
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    dispatch(updateProfile(form))
      .then(() => setSaveStatus('saved'))
      .catch((err) => {
        setSaveStatus('error');
        setFormErrors(err.response && err.response.data ? err.response.data : {});
      });
  };

  const handleTripClick = (tripId) => {
    if (loadingTripId) return;
    setLoadingTripId(tripId);
    dispatch(loadTripById(tripId))
      .then(() => navigate('/itinerary'))
      .catch(() => setLoadingTripId(null));
  };

  if (!isAuthenticated) {
    return (
      <div className="profile-empty">
        <h2>{t('profile.notLoggedIn.title')}</h2>
        <p>{t('profile.notLoggedIn.subtitle')}</p>
        <button onClick={() => navigate('/')}>{t('profile.notLoggedIn.goHome')}</button>
      </div>
    );
  }

  const renderTripCard = (trip) => (
    <div
      key={trip.id}
      className={`trip-card${loadingTripId === trip.id ? ' trip-card-loading' : ''}`}
      onClick={() => handleTripClick(trip.id)}
    >
      <div className="trip-card-destination">{trip.destination}</div>
      <div className="trip-card-meta">
        {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : t('profile.history.noDate')}
        {' · '}
        {t('profile.history.duration', { count: trip.duration })}
      </div>
      {loadingTripId === trip.id && <div className="trip-card-loading-label">{t('profile.history.opening')}</div>}
    </div>
  );

  return (
    <div className="profile-page">
      <div className="profile-content">
        <section className="profile-section">
          <h2>{t('profile.info.title')}</h2>
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="profile-field">
              <label>{t('profile.info.email')}</label>
              <input type="text" value={user?.Email || ''} disabled />
            </div>
            <div className="profile-field">
              <label>{t('profile.info.firstName')}</label>
              <input type="text" name="FirstName" value={form.FirstName} onChange={handleChange} />
              {formErrors.FirstName && <span className="profile-field-error">{formErrors.FirstName}</span>}
            </div>
            <div className="profile-field">
              <label>{t('profile.info.lastName')}</label>
              <input type="text" name="LastName" value={form.LastName} onChange={handleChange} />
              {formErrors.LastName && <span className="profile-field-error">{formErrors.LastName}</span>}
            </div>
            <div className="profile-field">
              <label>{t('profile.info.phone')}</label>
              <input type="text" name="Phone" value={form.Phone} onChange={handleChange} />
            </div>
            <button type="submit" className="profile-save-btn" disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving'
                ? t('profile.info.saving')
                : saveStatus === 'saved'
                ? t('profile.info.saved')
                : saveStatus === 'error'
                ? t('profile.info.retry')
                : t('profile.info.save')}
            </button>
          </form>
        </section>

        <section className="profile-section">
          <h2>{t('profile.history.title')}</h2>
          {myTripsLoading && <p>{t('profile.history.loadingList')}</p>}
          {myTripsError && <p className="profile-field-error">{myTripsError.message}</p>}
          {!myTripsLoading && !myTripsError && (
            <>
              <h3 className="profile-subheading">{t('profile.history.upcoming')}</h3>
              {myTrips.upcoming.length ? (
                <div className="trip-card-list">{myTrips.upcoming.map(renderTripCard)}</div>
              ) : (
                <p className="profile-empty-list">{t('profile.history.noUpcoming')}</p>
              )}
              <h3 className="profile-subheading">{t('profile.history.past')}</h3>
              {myTrips.past.length ? (
                <div className="trip-card-list">{myTrips.past.map(renderTripCard)}</div>
              ) : (
                <p className="profile-empty-list">{t('profile.history.noPast')}</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfilePage;
