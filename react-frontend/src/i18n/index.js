import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/translation.json';
import zh from './locales/zh/translation.json';

// Only covers static UI chrome (nav + homepage hero + trip-intake panel) —
// see CLAUDE.md's Pending Tasks for what's explicitly out of scope
// (the rest of the app, and the chatbot's server-generated conversation text).
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

export default i18n;
