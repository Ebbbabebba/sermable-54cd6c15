/**
 * Prop cues
 *
 * Syntax: `{{cue}}…{{/}}` wraps a sequence of words and attaches a small
 * "prop cue" to it (e.g. "smile", "laugh", "raise hand"). During practice
 * and presentation the wrapped words get a soft background highlight, and
 * a coloured badge floats above the manuscript while the speaker is reading
 * inside the range.
 *
 * The markers are IGNORED by speech recognition, AI analysis and word
 * counting — only the inner words count. Coexists with `[brackets]` (hidden
 * words), `(parens)` (stage directions) and `-` / `-Ns` (pause markers).
 */
import { stripStageDirections } from "./stageDirections";

const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;

/** Remove all prop-cue markers from text but keep the inner words. */
export const stripPropCueMarkers = (text: string): string => {
  if (!text) return "";
  return text.replace(/\{\{\/\}\}/g, "").replace(/\{\{[^{}]+\}\}/g, "");
};

export interface PropCueRange {
  /** The cue text (e.g. "smile"). */
  cue: string;
  /** First clean word index this cue covers. */
  startWordIndex: number;
  /** Last clean word index this cue covers (inclusive). */
  endWordIndex: number;
}

/**
 * Extract every prop-cue range from raw text. Indices are aligned to the
 * clean word array produced by `stripStageDirections(stripPropCueMarkers(text)).split(/\s+/)`.
 */
export const extractPropCues = (text: string): { cues: PropCueRange[] } => {
  const cues: PropCueRange[] = [];
  if (!text) return { cues };

  const stack: Array<{ cue: string; start: number }> = [];
  let wordIndex = 0;

  // Tokenise into: close marker, open marker, stage direction, whitespace
  // run, or a contiguous non-special chunk.
  const TOKEN_RE = /\{\{\/\}\}|\{\{([^{}]+)\}\}|\([^()]*\)|\s+|[^\s{}()]+/g;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const tok = m[0];
    if (tok === "{{/}}") {
      const open = stack.pop();
      if (open) {
        cues.push({
          cue: open.cue,
          startWordIndex: open.start,
          endWordIndex: Math.max(open.start, wordIndex - 1),
        });
      }
    } else if (m[1] !== undefined) {
      stack.push({ cue: m[1].trim(), start: wordIndex });
    } else if (tok.startsWith("(") && tok.endsWith(")")) {
      // stage direction — not a word
    } else if (/^\s+$/.test(tok)) {
      // whitespace
    } else if (PAUSE_TOKEN_RE.test(tok)) {
      // pause marker — stripped before practice / AI
    } else {
      wordIndex += 1;
    }
  }
  // Auto-close any unterminated cues
  while (stack.length) {
    const open = stack.pop()!;
    cues.push({
      cue: open.cue,
      startWordIndex: open.start,
      endWordIndex: Math.max(open.start, wordIndex - 1),
    });
  }
  return { cues };
};

/** Returns the cue currently active (if any) for the given word index. */
export const getActivePropCue = (
  cues: PropCueRange[],
  currentWordIndex: number,
): PropCueRange | null => {
  for (const r of cues) {
    if (currentWordIndex >= r.startWordIndex && currentWordIndex <= r.endWordIndex) {
      return r;
    }
  }
  return null;
};

/** Builds a quick lookup of {wordIndex → cue} for highlighting backgrounds. */
export const buildPropCueIndex = (
  cues: PropCueRange[],
): Map<number, PropCueRange> => {
  const map = new Map<number, PropCueRange>();
  for (const r of cues) {
    for (let i = r.startWordIndex; i <= r.endWordIndex; i++) map.set(i, r);
  }
  return map;
};

/** Convenience: clean text + cues in one pass. */
export const parsePropCues = (text: string) => {
  const plain = stripStageDirections(text); // strips cue markers too (after our change)
  const words = plain.split(/\s+/).filter(Boolean);
  return { words, ...extractPropCues(text) };
};

export const hasPropCues = (text: string): boolean => {
  if (!text) return false;
  return /\{\{[^{}]+\}\}/.test(text);
};
