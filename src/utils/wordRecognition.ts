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
  if (/^[A-Z]{2,4}$/.test(cleaned)) return true;

  // Short tokens that look like initials/acronyms: contain an uppercase letter
  // ("UA", "Wp", "JFK") OR are wrapped in periods ("u.a"). Plain lowercase
  // short words (the/och/är/and) are NOT auto-accepted — they're real words
  // the user must actually say.
  if (/^[A-Za-z]{2,3}$/.test(cleaned) && /[A-Z]/.test(cleaned)) return true;

  return false;
};

/**
 * Phonetic matching: accepts words spoken the way they sound even when the
 * recognizer transcribes a different spelling (e.g. brand names like
 * "Sermable" → "särmable"). Soundex-style key: keep the first letter, map
 * the rest to consonant-sound groups, drop vowels, collapse repeats.
 */
const PHONETIC_GROUP: Record<string, string> = {
  b: '1', p: '1', f: '1', v: '1', w: '1',
  c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
  d: '3', t: '3',
  l: '4',
  m: '5', n: '5',
  r: '6',
};

export const phoneticKey = (word: string): string => {
  const cleaned = word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}]+/gu, '');
  if (!cleaned) return '';

  let key = cleaned[0];
  let prev = PHONETIC_GROUP[cleaned[0]] ?? '';
  for (let i = 1; i < cleaned.length; i++) {
    const g = PHONETIC_GROUP[cleaned[i]] ?? '';
    if (g && g !== prev) key += g;
    prev = g;
  }
  return key;
};

const phoneticDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
};

/**
 * True when two words sound alike. Requires the expected word to be 4+
 * letters so short words never false-positive, keys to share the first
 * letter, and at most one edit between the phonetic keys.
 */
export const phoneticMatch = (spoken: string, expected: string): boolean => {
  const a = phoneticKey(spoken);
  const b = phoneticKey(expected);
  if (!a || !b) return false;
  if (expected.replace(/[^\p{L}]+/gu, '').length < 4) return false;
  if (a[0] !== b[0]) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  return b.length >= 4 && phoneticDistance(a, b) <= 1;
};
