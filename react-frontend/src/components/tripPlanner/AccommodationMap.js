import React, { useEffect, useRef } from 'react';
import useAMap from '../../hooks/useAmap';
import './AccommodationMap.css';

// Inline map for the lodging-flow accommodation confirm/suggest stages (see
// CLAUDE.md, "Planned: Lodging Flow", item #6). Renders a marker per
// candidate/suggestion; tapping one picks it, same as typing its name in chat.
const AccommodationMap = ({ locations, onSelect }) => {
  const { AMap, loaded } = useAMap();
  const mapInstance = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!loaded || !AMap) return;

    mapInstance.current = new AMap.Map('accommodation-map-container', {
      viewMode: '2D',
      zoom: 13
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, [loaded, AMap]);

  useEffect(() => {
    if (!mapInstance.current || !AMap) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    const validLocations = (locations || []).filter(
      (loc) => typeof loc.Latitude === 'number' && typeof loc.Longitude === 'number'
    );
    if (!validLocations.length) return;

    validLocations.forEach((loc) => {
      const position = [loc.Longitude, loc.Latitude];
      const marker = new AMap.Marker({ position, title: loc.Name, map: mapInstance.current });

      const infoWindow = new AMap.InfoWindow({
        content: `<div style="padding: 5px;"><h4 style="margin: 0 0 5px 0;">${loc.Name}</h4><p style="margin: 0;">${loc.Address || ''}</p></div>`,
        offset: new AMap.Pixel(0, -30)
      });

      marker.on('click', () => {
        infoWindow.open(mapInstance.current, position);
        onSelect(loc);
      });

      markersRef.current.push(marker);
    });

    if (validLocations.length === 1) {
      mapInstance.current.setZoomAndCenter(15, [validLocations[0].Longitude, validLocations[0].Latitude]);
    } else {
      mapInstance.current.setFitView(markersRef.current);
    }
  }, [locations, AMap, onSelect]);

  return (
    <div className="accommodation-map">
      {!loaded ? (
        <div className="accommodation-map-loading">Loading map…</div>
      ) : (
        <div id="accommodation-map-container" style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};

export default AccommodationMap;
