import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAMap from '../../hooks/useAmap';
import PropTypes from "prop-types";
import { connect } from "react-redux";
import withRouter from "../../utils/withRouter";
import { saveTrip } from "../../actions/tripAction";
import './Itinerary.css';
// placeholder photos, keyed by the `Photo` field the backend's mock generator assigns to each spot
import HawaiiWall from "../../images/hawaii-wall.jpg";
import KyotoWall from "../../images/Kyoto-wall.jpg";
import NYWall from "../../images/ny-wall.jpg";
import ShanghaiWall from "../../images/Shanghai-wall.jpg";

const PLACEHOLDER_PHOTOS = {
  hawaii: HawaiiWall,
  kyoto: KyotoWall,
  ny: NYWall,
  shanghai: ShanghaiWall
};

function spotsToMarkers(itinerary) {
  if (!itinerary) return [];
  return itinerary.days.flatMap((day) =>
    day.Spots.map((spot) => ({
      id: `${day.DayNumber}-${spot.Name}`,
      position: [spot.Longitude, spot.Latitude],
      title: spot.Name,
      content: spot.StreetAddress
    }))
  );
}

const Itinerary = ({ auth }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { itinerary } = useSelector((state) => state.trip);
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
  const geolocationRef = useRef(null);

  const [markers, setMarkers] = useState(() => spotsToMarkers(itinerary));

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
      // Add Geolocation
      geolocationRef.current = new AMap.Geolocation({
        enableHighAccuracy: true,
        timeout: 10000,
        position: {
          bottom: '10%',
          right: '5%'
        }
      });
      mapInstance.current.addControl(geolocationRef.current);

      // Get current position and center map
      geolocationRef.current.getCurrentPosition((status, result) => {
        if (status === 'complete') {
          const position = [result.position.lng, result.position.lat];
          mapInstance.current.setCenter(position);

          // Add a marker for current location
          setMarkers(prev => [
            ...prev,
            {
              id: Date.now(),
              position: position,
              title: t('itinerary.map.yourLocationTitle'),
              content: t('itinerary.map.yourLocationContent')
            }
          ]);
        } else {
          // Fallback to the destination (or Beijing) if geolocation fails
          console.error('Geolocation error:', result);
          const fallback = markers[0] ? markers[0].position : [116.397428, 39.90923];
          mapInstance.current.setCenter(fallback);
        }
      });

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
      const marker = new AMap.Marker({
        position: markerData.position,
        title: markerData.title,
        map: mapInstance.current
      });

      // Create InfoWindow
      const infoWindow = new AMap.InfoWindow({
        content: `
          <div style="padding: 5px;">
            <h3 style="margin: 0 0 5px 0;">${markerData.title}</h3>
            <p style="margin: 0;">${markerData.content}</p>
          </div>
        `,
        offset: new AMap.Pixel(0, -30)
      });

      // Add click event to show InfoWindow
      marker.on('click', () => {
        infoWindow.open(mapInstance.current, markerData.position);
      });

      markersRef.current.push(marker);
    });
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
    <div className="container" ref={containerRef}>
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
          {itinerary.days.map((day) => (
            <div key={day.DayNumber} className="day-block">
              <h3>{t('itinerary.day', { number: day.DayNumber })}</h3>
              <div className="spot-cards">
                {day.Spots.map((spot) => (
                  <div key={spot.Name} className="spot-card">
                    <img src={PLACEHOLDER_PHOTOS[spot.Photo] || HawaiiWall} alt={spot.Name} />
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