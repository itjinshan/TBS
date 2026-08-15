import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyTrips, loadTripById } from '../../actions/tripAction';
import './HistoryPage.css';

// Wanderlog-style "Your history" table — a complete, chronological listing
// of every saved trip (past and upcoming together), as the denser
// counterpart to the profile page's card grid (which only shows upcoming
// trips). Reachable from Navbar.js's account dropdown and from
// ProfilePage.js's "See all" link.
const HistoryPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state) => state.auth);
  const { myTrips, myTripsLoading, myTripsError } = useSelector((state) => state.trip);
  const [loadingTripId, setLoadingTripId] = useState(null);

  useEffect(() => {
    if (isAuthenticated) dispatch(getMyTrips());
  }, [isAuthenticated, dispatch]);

  const handleTripClick = (tripId) => {
    if (loadingTripId) return;
    setLoadingTripId(tripId);
    dispatch(loadTripById(tripId))
      .then(() => navigate('/itinerary'))
      .catch(() => setLoadingTripId(null));
  };

  if (!isAuthenticated) {
    return (
      <div className="history-empty">
        <h2>{t('profile.notLoggedIn.title')}</h2>
        <p>{t('profile.notLoggedIn.subtitle')}</p>
        <button onClick={() => navigate('/')}>{t('profile.notLoggedIn.goHome')}</button>
      </div>
    );
  }

  // Upcoming first (soonest first), then past (most recent first) — the
  // same "what's next" priority the profile page's card grid already
  // leads with, just continued into a single combined list here.
  const rows = [
    ...[...myTrips.upcoming].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0)),
    ...[...myTrips.past].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0))
  ];

  return (
    <div className="history-page">
      <h1 className="history-title">{t('history.title')}</h1>

      {myTripsLoading && <p>{t('profile.trips.loadingList')}</p>}
      {myTripsError && <p className="history-error">{myTripsError.message}</p>}

      {!myTripsLoading && !myTripsError && (
        rows.length ? (
          <div className="history-table-wrap">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t('history.columns.destination')}</th>
                  <th>{t('history.columns.duration')}</th>
                  <th>{t('history.columns.startDate')}</th>
                  <th>{t('history.columns.travelers')}</th>
                  <th>{t('history.columns.budget')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((trip) => (
                  <tr
                    key={trip.id}
                    className={loadingTripId === trip.id ? 'history-row-loading' : ''}
                    onClick={() => handleTripClick(trip.id)}
                  >
                    <td className="history-cell-destination">{trip.destination}</td>
                    <td>{t('profile.trips.duration', { count: trip.duration })}</td>
                    <td>{trip.startDate ? new Date(trip.startDate).toLocaleDateString() : t('profile.trips.noDate')}</td>
                    <td>{trip.numOfTravelers || '—'}</td>
                    <td>{trip.budget || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="profile-empty-list">{t('history.empty')}</p>
        )
      )}
    </div>
  );
};

export default HistoryPage;
