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
export const PAUSE_MIN_SECONDS = 0;
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

/**
 * Convert pause-style stage directions written by the AI (or pasted by the
 * user) into real pause markers. "(paus)" → "-2s", "(kort paus)" → "-1s",
 * "(lång paus)" → "-4s", "(pause 3 seconds)" → "-3s".
 * Non-pause stage directions like "(look at the bride)" are left untouched.
 */
const PAUSE_WORDS =
  "paus|pausa|pause|pausiere|pausa breve|silence|silenzio|silencio|silêncio|beat";
const SHORT_WORDS = "kort|short|brief|kurze|kurz|petite|courte|breve|corta|curta";
const LONG_WORDS = "lång|lang|long|longue|lunga|larga|longa|lange";

const PAUSE_DIRECTION_RE = new RegExp(
  `\\(\\s*(?:(?:ta|take|faire|fai|haz|faça|mach)\\s+(?:en|a|une|una|um|eine)\\s+)?(?:(${SHORT_WORDS})\\s+|(${LONG_WORDS})\\s+)?(?:${PAUSE_WORDS})` +
    `(?:\\s+(?:i|for|of|de|von|på)\\s*)?\\s*(\\d{1,2})?\\s*` +
    `(?:s|sek|sec|secs|sekunder|sekunden|seconds|second|segundos|secondi|secondes)?\\s*[.!]?\\s*\\)`,
  "gi",
);

export const convertPauseDirectionsToMarkers = (text: string): string => {
  if (!text) return text;
  const replaced = text.replace(
    PAUSE_DIRECTION_RE,
    (_m, short?: string, long?: string, num?: string) => {
      let seconds = PAUSE_DEFAULT_SECONDS;
      if (num) seconds = parseInt(num, 10);
      else if (short) seconds = 1;
      else if (long) seconds = 4;
      const clamped = Math.max(
        1,
        Math.min(PAUSE_MAX_SECONDS, seconds || PAUSE_DEFAULT_SECONDS),
      );
      return `-${clamped}s`;
    },
  );
  // Tidy spacing around inserted markers.
  return replaced
    .replace(/[ \t]+(-\d{1,2}s)/g, " $1")
    .replace(/(-\d{1,2}s)[ \t]*([,.;:!?])/g, "$2 $1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n");
};
