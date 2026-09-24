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
import { stripPropCueMarkers } from "./propCues";

// Legacy inline syntax (kept only for back-compat with older scripts).
// New scripts attach directions via the selection-driven {{cue}}…{{/}} markers.
const STAGE_DIRECTION_REGEX = /\(([^()]*)\)/g;

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
  const noCueMarkers = stripPropCueMarkers(text);
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
const SCRIPT_TOKEN_RE = /\{\{\/\}\}|\{\{([^{}]+)\}\}|\([^()]*\)|\s+|[^\s{}()]+/g;
const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;

export const tokenizeScript = (
  text: string,
): { tokens: ScriptToken[]; words: string[] } => {
  const tokens: ScriptToken[] = [];
  const words: string[] = [];
  if (!text) return { tokens, words };

  let wordIndex = 0;
  let lastWordIndex = -1;
  let m: RegExpExecArray | null;
  SCRIPT_TOKEN_RE.lastIndex = 0;

  while ((m = SCRIPT_TOKEN_RE.exec(text)) !== null) {
    const tok = m[0];
    // Prop-cue markers `{{cue}}` / `{{/}}` are not words and not directions.
    if (tok === "{{/}}" || m[1] !== undefined) continue;
    if (/^\s+$/.test(tok)) continue;
    if (tok.startsWith("(") && tok.endsWith(")")) {
      const inner = tok.slice(1, -1).trim();
      if (inner.length > 0) {
        tokens.push({ type: "direction", text: inner, afterWordIndex: lastWordIndex });
      }
      continue;
    }
    // Pause markers (`-`, `-3s`) are non-spoken artefacts.
    if (PAUSE_TOKEN_RE.test(tok)) continue;

    tokens.push({ type: "word", text: tok, wordIndex });
    words.push(tok);
    lastWordIndex = wordIndex;
    wordIndex += 1;
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
