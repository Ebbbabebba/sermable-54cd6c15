import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface WordState {
  text: string;
  isVisible: boolean;
  isSpoken: boolean;
  isCurrent: boolean;
  isHesitated: boolean;
  isMissed: boolean;
}

interface SentenceDisplayProps {
  text: string;
  hiddenWordIndices: Set<number>;
  currentWordIndex: number;
  spokenIndices: Set<number>;
  hesitatedIndices: Set<number>;
  missedIndices: Set<number>;
  /** Word indices that fall inside a {{cue}}…{{/}} prop-cue range. */
  propCueIndices?: Set<number>;
  /** Word index offset: the first word in `text` corresponds to this clean
   *  word index in the source script. Used to align prop-cue ranges that
   *  were extracted from the full script. Defaults to 0. */
  wordIndexOffset?: number;
  onWordTap?: (index: number) => void;
}

// Smooth easing for a calmer, gliding pulse feel
const smoothTransition = { duration: 0.28, ease: "easeInOut" as const };

const SentenceDisplay = ({
  text,
  hiddenWordIndices,
  currentWordIndex,
  spokenIndices,
  hesitatedIndices,
  missedIndices,
  propCueIndices,
  wordIndexOffset = 0,
  onWordTap,
}: SentenceDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  const words = text.split(/\s+/).filter(w => w.trim());

  // The blue pulse must reflect the actual cursor position only. Any visual
  // lookahead makes it feel like the app has moved to words the speaker has
  // not reached yet, especially when recognition emits delayed chunks.
  const pulseIndex = currentWordIndex;


  // Auto-scroll to the pulsing word — but only when it is actually out of
  // view. Re-centering on every word made the whole card jump around while
  // the speaker was reading.
  useEffect(() => {
    const el = currentWordRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const er = el.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    const outOfView =
      er.top < cr.top || er.bottom > cr.bottom ||
      er.left < cr.left || er.right > cr.right;
    if (outOfView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [pulseIndex]);


  const getWordState = (index: number): WordState => {
    const word = words[index];
    const isVisible = !hiddenWordIndices.has(index);
    const isSpoken = spokenIndices.has(index);
    // `isCurrent` drives the blue pulse / ring. We point it at the next
    // not-yet-resolved word so the cursor visibly advances when the
    // current word gets marked yellow (hesitated) or red (missed).
    const isCurrent = index === pulseIndex;
    const isHesitated = hesitatedIndices.has(index);
    const isMissed = missedIndices.has(index);

    return {
      text: word,
      isVisible,
      isSpoken,
      isCurrent,
      isHesitated,
      isMissed,
    };
  };


  const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;

  const renderWord = (index: number) => {
    const state = getWordState(index);

    // Pause marker (`-` or `-3s`) — render as a soft pill that the speaker
    // can see while they wait. Turns "spoken" (gray) once the timer ends.
    if (PAUSE_TOKEN_RE.test(state.text)) {
      return (
        <motion.span
          key={`${index}-pause`}
          ref={state.isCurrent ? currentWordRef : undefined}
          initial={false}
          animate={{
            opacity: state.isSpoken ? 0.4 : 1,
            scale: state.isCurrent && !state.isSpoken ? [1, 1.06, 1] : 1,
          }}
          transition={{
            opacity: { duration: 0.25 },
            scale: state.isCurrent && !state.isSpoken
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.25 },
          }}
          className={cn(
            "s-i4 s-ib s-ig s-m4 s-or s-ox s-qe s-tw align-middle",
            state.isCurrent && !state.isSpoken
              ? "s-5f s-uw s-pl s-pz s-d3"
              : state.isSpoken
                ? "s-55 s-uo"
                : "s-5e s-uw",
          )}
          aria-label="pause"
        >
          —
        </motion.span>
      );
    }
    
    // Hidden word that was MISSED - reveal it in red so user can see what they got wrong
    if (!state.isVisible && state.isMissed) {
      return (
        <motion.span
          key={`${index}-missed`}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={smoothTransition}
          className={cn(
            "s-i3 s-m4 s-op s-ox s-q8 s-8m",
            "practice-word practice-word--missed s-4k s-u2 s-d0 s-pl s-pp"
          )}
        >
          {state.text}
        </motion.span>
      );
    }
    
    // Hidden word that was HESITATED - reveal it in yellow
    if (!state.isVisible && state.isHesitated) {
      return (
        <motion.span
          key={`${index}-hesitated`}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={smoothTransition}
          className={cn(
            "s-i3 s-m4 s-op s-ox s-q8 s-8m",
            "practice-word practice-word--hesitated s-64 s-ve s-d0 s-pl s-q3"
          )}
        >
          {state.text}
        </motion.span>
      );
    }
    
    // Hidden word - show as dots (not yet spoken)
    if (!state.isVisible) {
      const dotCount = Math.ceil(state.text.length / 2);
      return (
        <motion.span
          key={`${index}-hidden`}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          animate={state.isCurrent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{
            scale: state.isCurrent
              ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.25 },
          }}
          className={cn(
            "practice-word practice-word--hidden s-i3 s-m4 s-op s-ox s-q8 s-8m s-ws s-bo",
            state.isCurrent &&
              "s-pm s-pw s-5g s-uw s-d3 s-qu",
            !state.isCurrent && "s-uo s-h0"
          )}
        >
          {"•".repeat(dotCount)}
        </motion.span>
      );
    }

    // Visible or spoken word - smooth fade for spoken state
    return (
      <motion.span
        key={`${index}-visible`}
        ref={state.isCurrent ? currentWordRef : undefined}
        initial={false}
        animate={{
          scale: state.isCurrent && !state.isSpoken ? 1.03 : 1,
        }}
        transition={{
          scale: { duration: 0.2, ease: "easeOut" },
        }}
        className={cn(
          "practice-word s-i3 s-m3 s-ol s-ox s-q8 s-ws s-bo",
          // Spoken wins over every other state — a correctly said word is
          // mint and stays mint, so it never flutters between yellow/blue/gray
          // while interim results keep arriving.
          state.isSpoken
            ? "practice-word--correct"
            : cn(
                state.isHesitated && "practice-word--hesitated s-64 s-ve",
                // Prop-cue background — soft warm highlight on the wrapped sequence
                propCueIndices?.has(index + wordIndexOffset) && "s-3o",
                // Clear marker for the current word — a distinct blue ring and
                // tint so there is no doubt about which word to say next.
                state.isCurrent && "practice-word--current s-pd s-uw s-d0"
              )
          // NOTE: Visible words never turn red (per project rule). Red is reserved
          // for hidden words that were missed (handled in the !isVisible branch above).
        )}
      >
        {state.text}
      </motion.span>
    );
  };


  return (
    <div
      ref={containerRef}
      className="practice-reading-text s-vi s-kj s-iy s-ip s-u0 s-my s-qq"
    >
      {words.map((_, index) => renderWord(index))}
    </div>
  );
};

export default SentenceDisplay;
