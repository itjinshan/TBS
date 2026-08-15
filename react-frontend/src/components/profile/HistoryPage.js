import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyTrips, loadTripById } from '../../actions/tripAction';
import './HistoryPage.css';

const HistoryTable = ({ trips, loadingTripId, onTripClick, t }) => (
  <div className="history-table-wrap">
    <table className="history-table">
      <thead>
        <tr>
          <th></th>
          <th>{t('history.columns.destination')}</th>
          <th>{t('history.columns.duration')}</th>
          <th>{t('history.columns.startDate')}</th>
          <th>{t('history.columns.travelers')}</th>
          <th>{t('history.columns.budget')}</th>
        </tr>
      </thead>
      <tbody>
        {trips.map((trip) => (
          <tr
            key={trip.id}
            className={loadingTripId === trip.id ? 'history-row-loading' : ''}
            onClick={() => onTripClick(trip.id)}
          >
            <td className="history-cell-cover">
              {trip.coverPhoto
                ? <img className="history-cover-photo" src={trip.coverPhoto} alt={trip.destination} />
                : <div className="history-cover-placeholder" aria-hidden="true">{trip.destination?.[0] || '?'}</div>}
            </td>
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
);

// Wanderlog-style "Your history" table — the denser counterpart to the
// profile page's card grid, split into the same upcoming/past sections
// rather than one merged chronological list, so both pages agree on what
// counts as "upcoming" vs. "past".
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

  const upcoming = [...myTrips.upcoming].sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  const past = [...myTrips.past].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));

  return (
    <div className="history-page">
    <div className="history-container">
      <h1 className="history-title">{t('history.title')}</h1>

      {myTripsLoading && <p>{t('profile.trips.loadingList')}</p>}
      {myTripsError && <p className="history-error">{myTripsError.message}</p>}

      {!myTripsLoading && !myTripsError && (
        <>
          <h2 className="history-subheading">{t('profile.trips.upcoming')}</h2>
          {upcoming.length ? (
            <HistoryTable trips={upcoming} loadingTripId={loadingTripId} onTripClick={handleTripClick} t={t} />
          ) : (
            <p className="profile-empty-list">{t('profile.trips.noUpcoming')}</p>
          )}

          <h2 className="history-subheading">{t('profile.trips.past')}</h2>
          {past.length ? (
            <HistoryTable trips={past} loadingTripId={loadingTripId} onTripClick={handleTripClick} t={t} />
          ) : (
            <p className="profile-empty-list">{t('profile.trips.noPast')}</p>
          )}
        </>
      )}
    </div>
    </div>
  );
};

export default HistoryPage;
