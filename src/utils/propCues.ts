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

// ---------------------------------------------------------------------------
// Tap-to-tag helpers (word picker)
// ---------------------------------------------------------------------------

interface WordToken {
  /** Clean word index (aligned with PropCueRange indices). */
  index: number;
  /** Character offset in the raw text where the word starts. */
  start: number;
  /** Character offset in the raw text just after the word. */
  end: number;
  text: string;
}

const ALL_TOKEN_RE = /\{\{\/\}\}|\{\{([^{}]+)\}\}|\([^()]*\)|\s+|[^\s{}()]+/g;

/** Tokenise raw text into the plain words the speaker actually says. */
export const tokenizeWords = (text: string): WordToken[] => {
  const out: WordToken[] = [];
  if (!text) return out;
  let wordIndex = 0;
  let m: RegExpExecArray | null;
  ALL_TOKEN_RE.lastIndex = 0;
  while ((m = ALL_TOKEN_RE.exec(text)) !== null) {
    const tok = m[0];
    if (tok === "{{/}}" || m[1] !== undefined) continue;
    if (tok.startsWith("(") && tok.endsWith(")")) continue;
    if (/^\s+$/.test(tok)) continue;
    if (PAUSE_TOKEN_RE.test(tok)) continue;
    out.push({ index: wordIndex, start: m.index, end: m.index + tok.length, text: tok });
    wordIndex += 1;
  }
  return out;
};

/** Wrap the given word indices (grouped into contiguous runs) with a cue. */
export const applyPropCueToIndices = (
  text: string,
  indices: number[],
  cue: string,
): string => {
  const clean = cue.trim();
  const tokens = tokenizeWords(text);
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (!clean || sorted.length === 0) return text;

  // Build contiguous runs
  const runs: Array<[number, number]> = [];
  let runStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
    } else {
      runs.push([runStart, prev]);
      runStart = sorted[i];
      prev = sorted[i];
    }
  }
  runs.push([runStart, prev]);

  let next = text;
  // Apply from the end so earlier offsets stay valid
  for (let i = runs.length - 1; i >= 0; i--) {
    const [s, e] = runs[i];
    const startTok = tokens.find((tk) => tk.index === s);
    const endTok = tokens.find((tk) => tk.index === e);
    if (!startTok || !endTok) continue;
    next =
      next.slice(0, startTok.start) +
      `{{${clean}}}` +
      next.slice(startTok.start, endTok.end) +
      `{{/}}` +
      next.slice(endTok.end);
  }
  return next;
};

/** Remove the cue that covers the given word index (markers only, words kept). */
export const removePropCueAt = (text: string, wordIndex: number): string => {
  if (!text) return text;
  const stack: Array<{ openStart: number; openEnd: number; startWord: number }> = [];
  let wIdx = 0;
  let m: RegExpExecArray | null;
  ALL_TOKEN_RE.lastIndex = 0;
  while ((m = ALL_TOKEN_RE.exec(text)) !== null) {
    const tok = m[0];
    if (m[1] !== undefined) {
      stack.push({ openStart: m.index, openEnd: m.index + tok.length, startWord: wIdx });
    } else if (tok === "{{/}}") {
      const open = stack.pop();
      if (open && wordIndex >= open.startWord && wordIndex <= wIdx - 1) {
        return (
          text.slice(0, open.openStart) +
          text.slice(open.openEnd, m.index) +
          text.slice(m.index + tok.length)
        ).replace(/[ \t]{2,}/g, " ");
      }
    } else if (tok.startsWith("(") && tok.endsWith(")")) {
      // stage direction
    } else if (/^\s+$/.test(tok)) {
      // whitespace
    } else if (PAUSE_TOKEN_RE.test(tok)) {
      // pause marker
    } else {
      wIdx += 1;
    }
  }
  return text;
};
