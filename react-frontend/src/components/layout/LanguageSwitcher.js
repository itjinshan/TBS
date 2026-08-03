import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'zh', label: '中文' }
];

// Reusable language-switcher wrapper (see CLAUDE.md, "Pending Tasks" —
// scoped to nav + homepage hero + trip-intake panel for now). i18n's own
// resolvedLanguage already reflects a persisted choice or the browser's
// language guess (see src/i18n/index.js), so this just needs to render it
// and call changeLanguage on click.
const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  return (
    <div className="language-switcher">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          className={`language-option ${i18n.resolvedLanguage === lang.code ? 'active' : ''}`}
          onClick={() => i18n.changeLanguage(lang.code)}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
