import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import axios from 'axios';

import en from './locales/en/translation.json';
import zh from './locales/zh/translation.json';

// Covers static UI chrome (nav + homepage hero + trip-intake panel + auth
// modals) — see CLAUDE.md's Pending Tasks for what's explicitly out of scope
// (the Itinerary page, and any server-generated text — auth error messages
// included — which needs backend i18n, not just this frontend catalog).
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    interpolation: {
      escapeValue: false
    },
    detection: {
      // Explicit user choice (persisted in localStorage) wins if present,
      // otherwise fall back to the browser's own language setting. This is
      // a browser-language guess only — true IP-region-based default (the
      // "China IP -> Chinese default" behavior from CLAUDE.md's Pending
      // Tasks) is a separate, not-yet-built item.
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tbs_language'
    }
  });

// Keeps the backend in sync with whatever this covers on the frontend —
// the Node backend's server-generated text (chat replies, auth error
// messages, ...) can't be reached by this client-side catalog, so it reads
// the traveler's language off this standard header instead (see Node/index.js's
// language middleware and Node/Utils/i18n.js). Fires once during init
// (with the detected/persisted language) and again on every LanguageSwitcher
// click, so every request from then on carries the current language.
i18n.on('languageChanged', (lng) => {
  axios.defaults.headers.common['Accept-Language'] = lng;
});

export default i18n;
