import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './translations';

// 2. Initialize i18next
i18n
  .use(LanguageDetector)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // Not needed for vanilla JS/TS
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'] // Remembers user selection on refresh
    }
  }, (err) => {
    if (err) return console.error(err);
    updateContent();
  });

/**
 * 3. The Helper Function
 * Scans the DOM for any element with 'data-i18n' and updates its text.
 * It also supports passing variables via 'data-i18n-options'.
 */
export function updateContent() {
  const elements = document.querySelectorAll<HTMLElement>('[data-i18n]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const optionsAttr = el.getAttribute('data-i18n-options');
    
    if (key) {
      const options = optionsAttr ? JSON.parse(optionsAttr) : {};
      el.textContent = i18n.t(key, options);
    }
  });
}

// 4. Listen for language changes to automatically refresh the UI
i18n.on('languageChanged', () => {
  updateContent();
});

export function getResolvedLanguage(): string | undefined {
  return i18n.resolvedLanguage;
}

export default i18n;