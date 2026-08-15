import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '../../actions/authAction';
import { getMyTrips, loadTripById } from '../../actions/tripAction';
import './ProfilePage.css';

const initials = (user) => `${user?.FirstName?.[0] || ''}${user?.LastName?.[0] || ''}`.toUpperCase();

// A trip card's cover: a real photo of the destination if one was found at
// save time (Node/APIs/trip.js's POST /trip, via Services/spotPhotos.js —
// see DB_Trip.js's CoverPhoto), otherwise the same gradient/initial
// placeholder every card used to show.
const TripCardCover = ({ trip }) => (
  trip.coverPhoto
    ? <img className="trip-card-cover-photo" src={trip.coverPhoto} alt={trip.destination} />
    : <div className="trip-card-cover" aria-hidden="true">{trip.destination?.[0] || '?'}</div>
);

const TripCardGrid = ({ trips, loadingTripId, onTripClick, t }) => (
  <div className="trip-card-grid">
    {trips.map((trip) => (
      <div
        key={trip.id}
        className={`trip-card${loadingTripId === trip.id ? ' trip-card-loading' : ''}`}
        onClick={() => onTripClick(trip.id)}
      >
        <TripCardCover trip={trip} />
        <div className="trip-card-body">
          <div className="trip-card-destination">{trip.destination}</div>
          <div className="trip-card-meta">
            {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : t('profile.trips.noDate')}
            {' · '}
            {t('profile.trips.duration', { count: trip.duration })}
          </div>
          {loadingTripId === trip.id && <div className="trip-card-loading-label">{t('profile.trips.opening')}</div>}
        </div>
      </div>
    ))}
  </div>
);

// Wanderlog-style layout: a fixed identity sidebar alongside a full-width
// main column, rather than a single narrow centered card — see CLAUDE.md's
// "Pending Tasks", "Build a profile management page". The main column shows
// upcoming and past trips as their own card-grid sections; the same split
// also drives the denser table on /history (HistoryPage.js).
const ProfilePage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { myTrips, myTripsLoading, myTripsError } = useSelector((state) => state.trip);

  const [form, setForm] = useState({ FirstName: '', LastName: '', Phone: '' });
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
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
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    dispatch(updateProfile(form))
      .then(() => {
        setSaveStatus('saved');
        setIsEditing(false);
      })
      .catch((err) => {
        setSaveStatus('error');
        setFormErrors(err.response && err.response.data ? err.response.data : {});
      });
  };

  const handleCancelEdit = () => {
    setForm({
      FirstName: user?.FirstName || '',
      LastName: user?.LastName || '',
      Phone: user?.Phone || ''
    });
    setFormErrors({});
    setIsEditing(false);
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

  return (
    <div className="profile-page">
    <div className="profile-container">
      <aside className="profile-sidebar">
        <div className="profile-avatar">{initials(user) || '?'}</div>
        <h2 className="profile-name">{user?.FirstName} {user?.LastName}</h2>
        <p className="profile-email">{user?.Email}</p>

        {!isEditing ? (
          <button type="button" className="profile-edit-btn" onClick={() => setIsEditing(true)}>
            {t('profile.info.edit')}
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="profile-field">
              <label>{t('profile.info.firstName')}</label>
              <input type="text" name="FirstName" value={form.FirstName} onChange={handleChange} autoFocus />
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
            <div className="profile-form-actions">
              <button type="submit" className="profile-save-btn" disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? t('profile.info.saving') : t('profile.info.save')}
              </button>
              <button type="button" className="profile-cancel-btn" onClick={handleCancelEdit}>
                {t('profile.info.cancel')}
              </button>
            </div>
            {saveStatus === 'error' && <p className="profile-field-error">{t('profile.info.retry')}</p>}
          </form>
        )}
      </aside>

      <main className="profile-main">
        <div className="profile-main-header">
          <h2>{t('profile.trips.title')}</h2>
          <Link to="/history" className="profile-see-all">{t('profile.trips.seeAll')}</Link>
        </div>

        {myTripsLoading && <p>{t('profile.trips.loadingList')}</p>}
        {myTripsError && <p className="profile-field-error">{myTripsError.message}</p>}
        {!myTripsLoading && !myTripsError && (
          <>
            <h3 className="profile-subheading">{t('profile.trips.upcoming')}</h3>
            {myTrips.upcoming.length ? (
              <TripCardGrid trips={myTrips.upcoming} loadingTripId={loadingTripId} onTripClick={handleTripClick} t={t} />
            ) : (
              <p className="profile-empty-list">{t('profile.trips.noUpcoming')}</p>
            )}

            <h3 className="profile-subheading">{t('profile.trips.past')}</h3>
            {myTrips.past.length ? (
              <TripCardGrid trips={myTrips.past} loadingTripId={loadingTripId} onTripClick={handleTripClick} t={t} />
            ) : (
              <p className="profile-empty-list">{t('profile.trips.noPast')}</p>
            )}
          </>
        )}
      </main>
    </div>
    </div>
  );
};

export default ProfilePage;
