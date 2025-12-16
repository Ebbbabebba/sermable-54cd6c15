import { franc } from 'franc';

// Map franc language codes to our supported i18n language codes
const langCodeMap: Record<string, string> = {
  'eng': 'en',
  'spa': 'es',
  'fra': 'fr',
  'deu': 'de',
  'ita': 'it',
  'por': 'pt',
  'swe': 'sv',
};

export const detectTextLanguage = (text: string): string | null => {
  if (!text || text.trim().length < 10) {
    return null; // Not enough text to reliably detect language
  }

  const detectedCode = franc(text, { minLength: 10 });
  
  if (detectedCode === 'und') {
    return null; // Undetermined language
  }

  return langCodeMap[detectedCode] || null;
};

export const switchLanguageBasedOnText = (
  text: string,
  currentLang: string,
  changeLanguage: (lng: string) => void
): boolean => {
  const detectedLang = detectTextLanguage(text);
  
  if (detectedLang && detectedLang !== currentLang) {
    changeLanguage(detectedLang);
    return true;
  }
  
  return false;
};
