/**
 * Heuristic keyword extraction for "General overview" learning mode.
 *
 * A keyword is a content-bearing word the speaker must cover when retelling
 * freely: numbers, names/proper nouns, and longer non-stopwords. Filler and
 * connector words are never keywords — they stay visible as support text.
 */

const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;

export const normalizeForKeyword = (word: string): string =>
  word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

/**
 * Returns the indices of `words` that count as keywords.
 * `commonWords` is the pre-normalized gap/stopword set (COMMON_WORDS).
 */
export function getKeywordIndices(words: string[], commonWords: Set<string>): Set<number> {
  const keywords = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const raw = words[i];
    if (PAUSE_TOKEN_RE.test(raw)) continue;

    const clean = normalizeForKeyword(raw);
    if (!clean) continue;

    const hasDigit = /\d/.test(raw);
    const first = raw[0] ?? '';
    const isCapitalized =
      /^\p{L}$/u.test(first) &&
      first === first.toUpperCase() &&
      first !== first.toLowerCase();
    const prevEndsSentence = i === 0 || /[.!?]$/.test(words[i - 1] ?? '');
    const isCommon = commonWords.has(clean);

    if (hasDigit || (isCapitalized && !prevEndsSentence) || (!isCommon && clean.length >= 5)) {
      keywords.add(i);
    }
  }

  // Fallback: never leave a beat without keywords — mark every content word.
  if (keywords.size === 0) {
    for (let i = 0; i < words.length; i++) {
      const raw = words[i];
      const clean = normalizeForKeyword(raw);
      if (clean && !commonWords.has(clean) && !PAUSE_TOKEN_RE.test(raw)) {
        keywords.add(i);
      }
    }
  }

  return keywords;
}
