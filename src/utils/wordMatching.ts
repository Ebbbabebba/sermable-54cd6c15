// Shared word matching utilities for consistent behavior across practice modes

export const normalizeNordic = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[öø]/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ð/g, "d")
    .replace(/þ/g, "th")
    .replace(/-/g, " ") // Replace hyphens with spaces for matching
    .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž\s]/gi, ""); // Keep spaces!
};

export const normalizeWord = (word: string): string => {
  return normalizeNordic(word).replace(/\s+/g, ""); // Remove spaces after normalization
};

// Calculate word similarity score (0-1) for pronunciation matching
export const getWordSimilarity = (word1: string, word2: string): number => {
  const w1 = normalizeWord(word1);
  const w2 = normalizeWord(word2);

  // Exact match
  if (w1 === w2) return 1.0;

  // Very short words must match exactly (2 chars or less)
  if (w1.length <= 2 || w2.length <= 2) {
    return w1 === w2 ? 1.0 : 0.0;
  }

  // Prefix matching for truncated words - minimum 80% length match
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen / maxLen >= 0.8) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return 0.9;
  }

  // Character-by-character similarity
  let matches = 0;
  const compareLength = Math.min(w1.length, w2.length);
  for (let i = 0; i < compareLength; i++) {
    if (w1[i] === w2[i]) matches++;
  }

  return matches / Math.max(w1.length, w2.length);
};

// Check if words are similar enough to be considered a match
export const areWordsSimilar = (word1: string, word2: string, threshold: number = 0.6): boolean => {
  return getWordSimilarity(word1, word2) >= threshold;
};

// Common filler words to ignore
export const FILLER_WORDS = new Set([
  "um", "uh", "eh", "like", "youknow", "you", "know", "er", "ah", "hmm", "mhm"
]);

export const isFillerWord = (word: string): boolean => {
  const normalized = normalizeWord(word);
  return FILLER_WORDS.has(normalized);
};
