/**
 * Detects words that are inherently hard for speech recognition to process:
 * - Numbers and year ranges: "1905", "1905-1961", "2024"
 * - Parenthesized content: "(1905-1961)", "(born", "1961)"
 * - Mixed alphanumeric: "COVID-19", "B12"
 * - Abbreviations: "U.S.A.", "NATO"
 * 
 * These words are auto-accepted when ANY speech is detected,
 * since the speech recognition engine typically cannot reproduce them accurately.
 */
export const isHardToRecognizeWord = (word: string): boolean => {
  const cleaned = word.replace(/[()[\]{}"']/g, "").trim();
  if (!cleaned) return true; // Pure punctuation — skip

  // Contains any digit → hard to recognize (years, numbers, ranges)
  if (/\d/.test(cleaned)) return true;

  // Parenthesized tokens like "(1905-1961)" or "(born"
  if (/[()]/.test(word)) return true;

  // Abbreviations with dots: "U.S.A.", "Dr.", "etc."
  if (/^[A-Za-z]\.([A-Za-z]\.)+$/.test(cleaned)) return true;

  // All-caps abbreviations 2-4 chars: "NATO", "EU", "UN"
  if (/^[A-Z]{2,4}$/.test(cleaned)) return true;

  return false;
};
