import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAMap from '../../hooks/useAmap';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import withRouter from "../../utils/withRouter";
import { saveTrip, sendRefinementMessage } from "../../actions/tripAction";
import ItineraryChatPanel from './ItineraryChatPanel';
import './Itinerary.css';
// fallback photos, keyed by the placeholder `Photo` value the backend
// assigns when a real per-spot photo lookup (Services/spotPhotos.js) found
// nothing, or when the fallback itinerary generator ran instead
import HawaiiWall from "../../images/hawaii-wall.jpg";
import KyotoWall from "../../images/Kyoto-wall.jpg";
import NYWall from "../../images/ny-wall.jpg";
import ShanghaiWall from "../../images/Shanghai-wall.jpg";

// Kept in sync with ItineraryChatPanel.css's .itin-chat-panel.open/.collapsed
// widths — the container below is shrunk by exactly this much so the two
// never overlap or gap.
const CHAT_PANEL_WIDTH = 380;
const CHAT_PANEL_COLLAPSED_WIDTH = 56;

const PLACEHOLDER_PHOTOS = {
  hawaii: HawaiiWall,
  kyoto: KyotoWall,
  ny: NYWall,
  shanghai: ShanghaiWall
};

// `spot.Photo` is either a live Amap photo URL or one of the placeholder
// keys above — resolve whichever it is, defaulting to the Hawaii placeholder
// if it's neither (e.g. missing on an older saved trip).
function resolveSpotPhoto(photo) {
  if (!photo) return HawaiiWall;
  if (/^https?:\/\//.test(photo)) return photo;
  return PLACEHOLDER_PHOTOS[photo] || HawaiiWall;
}

// Spot-only fallback for a day with no Route at all — e.g.
// fallbackItinerary.js's output, which predates the Route field and never
// sets one. Same marker shape this file used for every day before route
// markers existed.
function daySpotsToMarkers(day) {
  return day.Spots.map((spot) => ({
    id: `${day.DayNumber}-spot-${spot.Name}`,
    type: 'spot',
    position: [spot.Longitude, spot.Latitude],
    title: spot.Name,
    content: spot.StreetAddress
  }));
}

function toWaypointMarker(stop) {
  return {
    id: `${stop.Type}-${stop.Name}-${stop.Latitude}-${stop.Longitude}`,
    type: stop.Type, // 'arrival' | 'accommodation' | 'spot' | 'departure'
    position: [stop.Longitude, stop.Latitude],
    title: stop.Name,
    content: stop.Address
  };
}

// Builds one marker per unique waypoint across the whole itinerary — fed
// from each day's Route (arrival/accommodation/spot/departure, in true
// visiting order — see itineraryPlanner.js's buildRoute()), not just
// Spots, per CLAUDE.md's "Reflect the itinerary's full route..." backlog
// item. Accommodation can appear verbatim in more than one day's Route
// array (the same hotel bookends both day N's end and day N+1's start) —
// deduped to one marker per unique waypoint so a multi-day trip doesn't
// stack duplicate pins on the same hotel; the day-by-day polylines built
// alongside this (see updateMarkers()) still connect through the shared
// point correctly, since each day's line is built independently from that
// day's own Route array, not from this deduped list.
function routeToMarkers(itinerary) {
  if (!itinerary) return [];
  const seen = new Set();
  const markers = [];
  itinerary.days.forEach((day) => {
    const stops = day.Route && day.Route.length ? day.Route : null;
    if (!stops) {
      markers.push(...daySpotsToMarkers(day));
      return;
    }
    stops.forEach((stop) => {
      if (typeof stop.Latitude !== 'number' || typeof stop.Longitude !== 'number') return;
      const marker = toWaypointMarker(stop);
      if (seen.has(marker.id)) return;
      seen.add(marker.id);
      markers.push(marker);
    });
  });
  return markers;
}

// Custom marker content (in place of AMap's default pin) so
// arrival/accommodation/departure waypoints read as visually distinct from
// regular spot stops — full per-day colored/numbered markers are a
// separate, larger backlog item, not part of this one.
const WAYPOINT_ICONS = { arrival: '✈️', accommodation: '🏨', departure: '🛫' };

// Candidates with no real coordinates (the unverified fallback pair — see
// APIs/trip.js's fallbackSuggestions()) aren't plottable; same "leave it
// out of the map, not the chat list" pattern buildRoute() already uses for
// unverified route bookends server-side.
function accommodationCandidatesToMarkers(candidates) {
  return (candidates || [])
    .filter((c) => typeof c.Latitude === 'number' && typeof c.Longitude === 'number')
    .map((c) => ({
      id: `accommodation-${c.Name}`,
      type: 'accommodation-candidate',
      position: [c.Longitude, c.Latitude],
      title: c.Name,
      content: c.Address,
      raw: c
    }));
}

const Itinerary = ({ auth }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { itinerary, refinementStage, accommodationCandidates } = useSelector((state) => state.trip);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error

  // AMap hook
  const { AMap, loaded } = useAMap();

  // Panel resizing state
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dividerRef = useRef(null);
  const startX = useRef(0);
  const startRatio = useRef(50);

  // Map references
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const routesRef = useRef([]);
  const geolocationRef = useRef(null);

  const [markers, setMarkers] = useState(() => routeToMarkers(itinerary));
  const [chatOpen, setChatOpen] = useState(true);

  // Keeps the map's markers in sync with `itinerary` itself, not just the
  // mount-time snapshot above — needed now that POST /trip/refine (via the
  // Itinerary-page chat panel) can mutate `itinerary` in place while this
  // page stays mounted. Without this, a post-swap itinerary would update
  // the day-list cards (read directly from the itinerary selector) but
  // leave stale map pins. Also merges in accommodation-candidate markers,
  // alongside (not replacing) the spot markers, while the refinement chat
  // is presenting them — the traveler picks a hotel relative to where the
  // spots actually are, so showing both together is the point.
  useEffect(() => {
    const showCandidates = refinementStage === 'pick_accommodation';
    setMarkers([
      ...routeToMarkers(itinerary),
      ...(showCandidates ? accommodationCandidatesToMarkers(accommodationCandidates) : [])
    ]);
  }, [itinerary, refinementStage, accommodationCandidates]);

  // Initialize map when AMap is loaded
  useEffect(() => {
    if (!loaded || !AMap) return;

    mapInstance.current = new AMap.Map('amap-container', {
      viewMode: '2D',
      zoom: 9, // Start with closer zoom for location
    });

    // Load required plugins
    AMap.plugin([
      'AMap.ControlBar',
      'AMap.Scale',
      'AMap.Geolocation',
      'AMap.MapType' // For layer switching
    ], () => {
      // Geolocation is added as a control only — a "locate me" button the
      // traveler can click, not auto-triggered on load. It used to fire
      // automatically here and both center the map and drop a "you are
      // here" marker at the browser's real-world location, which had
      // nothing to do with the trip's destination (e.g. an automated
      // session physically routed through mainland China would center a
      // Ghent or Beijing itinerary on Kunming instead). The map is now
      // centered/fit to the itinerary's own spot markers instead — see
      // updateMarkers()'s setFitView() call.
      geolocationRef.current = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        position: {
          bottom: '10%',
          right: '5%'
        }
      });
      mapInstance.current.addControl(geolocationRef.current);

      // Add ControlBar
      mapInstance.current.addControl(new AMap.ControlBar({
        showZoomBar: true,
        showControlButton: true,
        position: {
          top: '3%',
          right: '5%'
        }
      }));

      // Add MapType control (replaces LayerSwitcher)
      mapInstance.current.addControl(new AMap.MapType({
        defaultType: 0,
        showTraffic: false,
        showRoad: true,
        position: {
          top: '15%',
          right: '5%'
        }
      }));
    });

    // Initial markers
    updateMarkers(markers);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
      }
    };
  }, [loaded, AMap]);

  // Update markers when data changes
  useEffect(() => {
    if (mapInstance.current) {
      updateMarkers(markers);
    }
  }, [markers]);

  const updateMarkers = (newMarkers) => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers with InfoWindows
    newMarkers.forEach(markerData => {
      // arrival/accommodation/departure get a custom emoji marker in place
      // of AMap's default pin, so they read as visually distinct from
      // regular spot stops on the route — see WAYPOINT_ICONS above.
      const icon = WAYPOINT_ICONS[markerData.type];
      const marker = new AMap.Marker({
        position: markerData.position,
        title: markerData.title,
        map: mapInstance.current,
        ...(icon ? {
          content: `<div style="font-size:22px;line-height:1;">${icon}</div>`,
          offset: new AMap.Pixel(-11, -22)
        } : {})
      });

      // Create InfoWindow
      const isAccommodationCandidate = markerData.type === 'accommodation-candidate';
      const infoWindow = new AMap.InfoWindow({
        content: `
          <div style="padding: 5px;">
            <h3 style="margin: 0 0 5px 0;">${isAccommodationCandidate ? '🏨 ' : ''}${markerData.title}</h3>
            <p style="margin: 0;">${markerData.content}</p>
            ${isAccommodationCandidate ? '<p style="margin:4px 0 0;font-size:12px;color:#666;">Click marker to choose this hotel</p>' : ''}
          </div>
        `,
        offset: new AMap.Pixel(0, -30)
      });

      // Add click event to show InfoWindow — an accommodation-candidate
      // marker also picks it, same as typing its name in the refinement
      // chat (see ItineraryChatPanel.js / AccommodationMap.js's onSelect
      // for the intake-flow equivalent of this interaction).
      marker.on('click', () => {
        infoWindow.open(mapInstance.current, markerData.position);
        if (isAccommodationCandidate) {
          dispatch(sendRefinementMessage(markerData.raw.Name));
        }
      });

      markersRef.current.push(marker);
    });

    // Draw each day's route as its own polyline, in true visiting order —
    // built from that day's own Route array (itinerary.days[].Route, see
    // itineraryPlanner.js's buildRoute()) rather than the flattened/deduped
    // `newMarkers` list above, since flattening loses which day each point
    // belongs to. A day with fewer than two verified points can't form a
    // line and is skipped (e.g. no accommodation/arrival/departure known
    // and zero spots) — same "just show what's there" degradation the
    // route data itself already follows. Uniform styling across days
    // (not per-day colors) — that's the separate, larger "per-day colored
    // and numbered markers" backlog item, not part of this one.
    routesRef.current.forEach(line => line.setMap(null));
    routesRef.current = [];
    itinerary.days.forEach(day => {
      const path = (day.Route || [])
        .filter(stop => typeof stop.Latitude === 'number' && typeof stop.Longitude === 'number')
        .map(stop => [stop.Longitude, stop.Latitude]);
      if (path.length < 2) return;

      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#4285f4',
        strokeWeight: 4,
        strokeStyle: 'solid',
        showDir: true,
        map: mapInstance.current
      });
      routesRef.current.push(polyline);
    });

    // Fit the viewport to the itinerary's own markers and route lines
    // rather than leaving the map at its initial default center — see the
    // note on the removed geolocation auto-center above.
    const overlays = [...markersRef.current, ...routesRef.current];
    if (overlays.length) {
      mapInstance.current.setFitView(overlays);
    }
  };

  // Add new random marker
  const addRandomMarker = () => {
    const cities = [
      { name: "Guangzhou", position: [113.2644, 23.1291], desc: "Southern city" },
      { name: "Shenzhen", position: [114.0579, 22.5431], desc: "Tech hub" },
      { name: "Chengdu", position: [104.0665, 30.5728], desc: "Panda hometown" }
    ];
    const randomCity = cities[Math.floor(Math.random() * cities.length)];

    setMarkers(prev => [
      ...prev,
      {
        id: Date.now(),
        position: randomCity.position,
        title: randomCity.name,
        content: randomCity.desc
      }
    ]);
  };

  // Get current location
  const getCurrentLocation = () => {
    if (geolocationRef.current) {
      geolocationRef.current.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          const position = [result.position.lng, result.position.lat];
          setMarkers(prev => [
            ...prev,
            {
              id: Date.now(),
              position: position,
              title: "Your Location",
              content: "You are here!"
            }
          ]);
          mapInstance.current.setCenter(position);
        } else {
          console.error('Geolocation error:', result);
        }
      });
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    startX.current = e.clientX;
    startRatio.current = splitRatio;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const deltaX = e.clientX - startX.current;
    const deltaRatio = (deltaX / containerWidth) * 100;

    // Calculate new ratio based on starting position
    let newRatio = startRatio.current + deltaRatio;

    // Constrain between 25% and 75%
    newRatio = Math.max(25, Math.min(75, newRatio));

    setSplitRatio(newRatio);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  const handleSaveTrip = () => {
    setSaveStatus('saving');
    dispatch(saveTrip())
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('error'));
  };

  if (!itinerary) {
    return (
      <div className="itinerary-empty">
        <h2>{t('itinerary.noTrip.title')}</h2>
        <p>{t('itinerary.noTrip.subtitle')}</p>
        <button onClick={() => navigate('/')}>{t('itinerary.noTrip.planTrip')}</button>
      </div>
    );
  }

  return (
    <div className="itinerary-page">
    <div
      className="container"
      ref={containerRef}
      style={{ width: `calc(100vw - ${chatOpen ? CHAT_PANEL_WIDTH : CHAT_PANEL_COLLAPSED_WIDTH}px)` }}
    >
      {/* Left Panel - Day-by-day itinerary */}
      <div className="left-panel" style={{ width: `${splitRatio}%` }}>
        <div className="day-list">
          <div className="destination-header">
            <h2 className="destination-heading">{itinerary.destination}</h2>
            {auth?.isAuthenticated && (
              <button
                className="save-trip-btn"
                onClick={handleSaveTrip}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
              >
                {saveStatus === 'saving' ? t('itinerary.saveTrip.saving') : saveStatus === 'saved' ? t('itinerary.saveTrip.saved') : saveStatus === 'error' ? t('itinerary.saveTrip.retry') : t('itinerary.saveTrip.save')}
              </button>
            )}
          </div>
          {itinerary.arrivalPoint?.Name && (
            <div className="waypoint-card">
              <span className="waypoint-icon" aria-hidden="true">✈️</span>
              <div className="waypoint-info">
                <span className="waypoint-label">{t('itinerary.arrivingVia')}</span>
                <span className="waypoint-name">{itinerary.arrivalPoint.Name}</span>
              </div>
            </div>
          )}
          {itinerary.days.map((day) => (
            <div key={day.DayNumber} className="day-block">
              <h3>{t('itinerary.day', { number: day.DayNumber })}</h3>
              <div className="spot-cards">
                {day.Spots.map((spot) => (
                  <div key={spot.Name} className="spot-card">
                    <img src={resolveSpotPhoto(spot.Photo)} alt={spot.Name} />
                    <div className="spot-info">
                      <h4>{spot.Name}</h4>
                      <p className="spot-address">{spot.StreetAddress}</p>
                      <div className="spot-meta">
                        <span>{spot.BestTimeToVisitInDay?.Description}</span>
                        <span>{spot.AverageTimeSpent?.Description}</span>
                        <span className="spot-rating">{spot.Rating}/100</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {itinerary.departurePoint?.Name && (
            <div className="waypoint-card">
              <span className="waypoint-icon" aria-hidden="true">🛫</span>
              <div className="waypoint-info">
                <span className="waypoint-label">{t('itinerary.departingFrom')}</span>
                <span className="waypoint-name">{itinerary.departurePoint.Name}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resizable Divider */}
      <div
        ref={dividerRef}
        className="divider"
        onMouseDown={handleMouseDown}
        style={{ left: `${splitRatio}%` }}
      />

      {/* Right Panel - AMap with Controls */}
      <div className="right-panel" style={{ width: `${100 - splitRatio}%` }}>
        {!loaded ? (
          <div className="map-loading">
            {t('itinerary.loadingMap')}
          </div>
        ) : (
          <>
            <div id="amap-container" style={{ width: '100%', height: '100%' }} />
          </>
        )}
      </div>
    </div>
    <ItineraryChatPanel open={chatOpen} onToggle={() => setChatOpen((o) => !o)} />
    </div>
  );
};

Itinerary.propTypes = {
  auth: PropTypes.object.isRequired,
  errors: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
  auth: state.auth,
  errors: state.errors
});

export default connect(
  mapStateToProps
)(withRouter(Itinerary));