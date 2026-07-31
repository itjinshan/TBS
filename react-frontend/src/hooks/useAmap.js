import { useEffect, useState } from 'react';

const useAMap = () => {
  const [AMap, setAMap] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.AMap) {
      setAMap(window.AMap);
      setLoaded(true);
      return;
    }

    const key = process.env.REACT_APP_AMAP_KEY;
    if (!key) {
      console.error('REACT_APP_AMAP_KEY is not configured (see react-frontend/.env.local)');
      return;
    }

    // Required since Amap's 2021 JS API security policy — must be set on
    // window before the script tag below loads.
    window._AMapSecurityConfig = { securityJsCode: process.env.REACT_APP_AMAP_SECURITY_JS_CODE || '' };

    const callbackName = `amapInitCallback_${Date.now()}`;
    window[callbackName] = () => {
      setAMap(window.AMap);
      setLoaded(true);
      delete window[callbackName];
    };

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=AMap.Marker,AMap.InfoWindow,AMap.Geolocation,AMap.ControlBar&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      console.error('AMap script failed to load');
      delete window[callbackName];
    };
    document.head.appendChild(script);

    return () => {
      if (window[callbackName]) {
        delete window[callbackName];
      }
    };
  }, []);

  return { AMap, loaded };
};

export default useAMap;