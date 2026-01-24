import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { resources } from './translations';

i18n
  .use(LanguageDetector)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  }, (err) => {
    if (err) return console.error(err);
    updateContent();
  });

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

i18n.on('languageChanged', () => {
  updateContent();
});

export function getResolvedLanguage(): string | undefined {
  return i18n.resolvedLanguage;
}

export default i18n;