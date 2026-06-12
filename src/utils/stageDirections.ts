/**
 * Stage directions parser
 *
 * Convention: Anything wrapped in square brackets `[...]` is treated as a
 * stage direction (e.g. "[byt slide]", "[paus]", "[drick vatten]"). Stage
 * directions are:
 *   - IGNORED by speech recognition, AI analysis and word-hiding mechanics.
 *   - VISIBLE in presentation/teleprompter views as a visual cue.
 *
 * For backwards compatibility the legacy `(...)` syntax is still parsed
 * as a stage direction. New UI and onboarding only teaches brackets.
 */

import { stripPauses } from "./pauses";

const STAGE_DIRECTION_REGEX = /\[([^\[\]]*)\]|\(([^()]*)\)/g;

export interface DirectionToken {
  type: "direction";
  text: string; // text inside the parens, trimmed
  /** Word index in the *clean* (direction-stripped) word array AFTER which
   *  this direction should be rendered. -1 means before the first word. */
  afterWordIndex: number;
}

export interface WordToken {
  type: "word";
  text: string;
  /** Index in the clean word array. */
  wordIndex: number;
}

export type ScriptToken = WordToken | DirectionToken;

/**
 * Strip all stage directions from a piece of text. Returns a clean string
 * with normalised whitespace, suitable for speech recognition / AI / word
 * counting.
 */
export const stripStageDirections = (text: string): string => {
  if (!text) return "";
  // Strip prop-cue markers `{{cue}}…{{/}}` while keeping the inner words.
  const noCueMarkers = text
    .replace(/\{\{\/\}\}/g, "")
    .replace(/\{\{[^{}]+\}\}/g, "");
  const noDirections = noCueMarkers
    .replace(STAGE_DIRECTION_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Pause markers (e.g. `-`, `-3s`) are also non-spoken artefacts — strip
  // them so AI / speech recognition / word counting stay aligned with what
  // the user actually says.
  return stripPauses(noDirections);
};

/**
 * Tokenise a script into an ordered list of words and stage directions.
 * Directions retain their relative position (after which clean word they
 * appear) so views can render them inline without consuming a word index.
 */
export const tokenizeScript = (
  text: string,
): { tokens: ScriptToken[]; words: string[] } => {
  const tokens: ScriptToken[] = [];
  const words: string[] = [];
  if (!text) return { tokens, words };

  // Split text into segments alternating between content and direction tokens
  // (brackets are the canonical syntax; parens kept for back-compat).
  const parts = text.split(/(\[[^\[\]]*\]|\([^()]*\))/g);
  let wordIndex = 0;
  let lastWordIndex = -1;

  for (const part of parts) {
    if (!part) continue;
    const directionMatch = part.match(/^\[([^\[\]]*)\]$|^\(([^()]*)\)$/);
    if (directionMatch) {
      const inner = (directionMatch[1] ?? directionMatch[2] ?? "").trim();
      if (inner.length > 0) {
        tokens.push({
          type: "direction",
          text: inner,
          afterWordIndex: lastWordIndex,
        });
      }
      continue;
    }
    const partWords = part.split(/\s+/).filter((w) => w.length > 0);
    for (const w of partWords) {
      tokens.push({ type: "word", text: w, wordIndex });
      words.push(w);
      lastWordIndex = wordIndex;
      wordIndex += 1;
    }
  }

  return { tokens, words };
};

/**
 * Quick check whether a piece of text contains any stage directions.
 */
export const hasStageDirections = (text: string): boolean => {
  if (!text) return false;
  STAGE_DIRECTION_REGEX.lastIndex = 0;
  return STAGE_DIRECTION_REGEX.test(text);
};
