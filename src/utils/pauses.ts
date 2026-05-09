/**
 * Pause markers
 *
 * Convention: A standalone whitespace-bounded `-` token marks a pause the
 * speaker wants to take during delivery. An optional duration in seconds
 * may follow immediately, e.g. `-3` or `-3s`. Without a number the default
 * is 2 seconds.
 *
 * Examples (all valid, whitespace-bounded):
 *   "Hello world - and welcome"      → 2s pause after "world"
 *   "Hello world -3 and welcome"     → 3s pause after "world"
 *   "Hello world -5s and welcome"    → 5s pause after "world"
 *
 * Pauses are:
 *   - IGNORED by speech recognition / AI / word counting (stripped).
 *   - VISIBLE during practice as a full-screen dim + circular countdown,
 *     during which the microphone is muted.
 *
 * NOTE: hyphens inside words like "well-known" are NOT pauses — only
 * standalone whitespace-bounded tokens count.
 */

export const PAUSE_DEFAULT_SECONDS = 2;
export const PAUSE_MIN_SECONDS = 1;
export const PAUSE_MAX_SECONDS = 10;

const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;

export interface PauseMarker {
  /** Index in the clean (pause-stripped) word array AFTER which this pause
   *  is taken. -1 means before the first word. */
  afterWordIndex: number;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Index of this pause among all pauses in the source text (0-based). */
  pauseIndex: number;
}

const parseDuration = (token: string): number => {
  const m = token.match(PAUSE_TOKEN_RE);
  if (!m) return PAUSE_DEFAULT_SECONDS * 1000;
  const seconds = m[1] ? parseInt(m[1], 10) : PAUSE_DEFAULT_SECONDS;
  const clamped = Math.max(PAUSE_MIN_SECONDS, Math.min(PAUSE_MAX_SECONDS, seconds));
  return clamped * 1000;
};

/** Remove all pause tokens from `text`, returning a clean string suitable
 *  for AI / speech recognition / word counting. Whitespace is normalised. */
export const stripPauses = (text: string): string => {
  if (!text) return "";
  return text
    .split(/\s+/)
    .filter((tok) => tok.length > 0 && !PAUSE_TOKEN_RE.test(tok))
    .join(" ");
};

/** Extract the ordered list of pause markers from `text`. The
 *  `afterWordIndex` is relative to the pause-stripped word array. */
export const extractPauses = (text: string): PauseMarker[] => {
  const pauses: PauseMarker[] = [];
  if (!text) return pauses;
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  let cleanIdx = -1;
  let pauseIdx = 0;
  for (const tok of tokens) {
    if (PAUSE_TOKEN_RE.test(tok)) {
      pauses.push({
        afterWordIndex: cleanIdx,
        durationMs: parseDuration(tok),
        pauseIndex: pauseIdx,
      });
      pauseIdx += 1;
    } else {
      cleanIdx += 1;
    }
  }
  return pauses;
};

export const hasPauses = (text: string): boolean => {
  if (!text) return false;
  return text
    .split(/\s+/)
    .some((tok) => tok.length > 0 && PAUSE_TOKEN_RE.test(tok));
};

/** Replace the Nth pause token in `text` with a new duration (in seconds).
 *  Preserves all surrounding whitespace exactly. Returns text unchanged if
 *  `pauseIndex` is out of range. */
export const setPauseDurationInText = (
  text: string,
  pauseIndex: number,
  seconds: number,
): string => {
  if (!text) return text;
  const clamped = Math.max(
    PAUSE_MIN_SECONDS,
    Math.min(PAUSE_MAX_SECONDS, Math.round(seconds)),
  );
  // Split keeping whitespace runs as separate parts.
  const parts = text.split(/(\s+)/);
  let count = 0;
  for (let i = 0; i < parts.length; i++) {
    if (PAUSE_TOKEN_RE.test(parts[i])) {
      if (count === pauseIndex) {
        parts[i] = `-${clamped}s`;
        return parts.join("");
      }
      count += 1;
    }
  }
  return text;
};
