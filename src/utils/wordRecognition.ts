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
  // Pause tokens (`-`, `-3`, `-5s`) are not real words — never auto-accept them
  // as speech, or the pause overlay/mic-mute never triggers.
  if (/^-(\d{1,2})?s?$/.test(word.trim())) return false;

  const cleaned = word.replace(/[()[\]{}"']/g, "").trim();
  if (!cleaned) return true; // Pure punctuation — skip

  // Contains any digit → hard to recognize (years, numbers, ranges)
  if (/\d/.test(cleaned)) return true;

  // Parenthesized tokens like "(1905-1961)" or "(born"
  if (/[()]/.test(word)) return true;

  // Abbreviations with dots: "U.S.A.", "Dr.", "etc."
  if (/^[A-Za-z]\.([A-Za-z]\.)+$/.test(cleaned)) return true;

  // All-caps abbreviations 2-4 chars: "NATO", "EU", "UN"
  if (/^[A-Z]{2,6}$/.test(cleaned)) return true;

  // Mixed-case product/company names: "SpaceX", "iPhone", "OpenAI".
  // Speech engines often split or rewrite these ("space x", "open ai").
  if (/[a-zåäö][A-ZÅÄÖ]/.test(cleaned) || /^[a-zåäö]+[A-ZÅÄÖ]/.test(cleaned)) return true;

  // Short tokens that look like initials/acronyms: contain an uppercase letter
  // ("UA", "Wp", "JFK") OR are wrapped in periods ("u.a"). Plain lowercase
  // short words (the/och/är/and) are NOT auto-accepted — they're real words
  // the user must actually say.
  if (/^[A-Za-z]{2,3}$/.test(cleaned) && /[A-Z]/.test(cleaned)) return true;

  return false;
};

export const normalizeRecognitionWord = (word: string): string =>
  word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

export const isStrongSpeechFragmentMatch = (spoken: string, expected: string): boolean => {
  const s = normalizeRecognitionWord(spoken);
  const e = normalizeRecognitionWord(expected);

  if (!s || !e) return false;
  if (s === e) return true;

  if (isHardToRecognizeWord(expected) && s.length >= 2) return true;

  const minPrefix = e.length >= 10 ? 4 : e.length >= 6 ? 3 : 2;
  if (e.length >= 6 && s.length >= minPrefix && e.startsWith(s)) return true;
  if (s.length >= 6 && e.length >= minPrefix && s.startsWith(e)) return true;

  // Long compound words are often transcribed as a shorter first piece,
  // e.g. "aktie" for "aktiesparare". Accept a substantial opening fragment.
  if (e.length >= 9 && s[0] === e[0] && e.startsWith(s) && s.length >= Math.ceil(e.length * 0.3)) {
    return true;
  }

  return false;
};
