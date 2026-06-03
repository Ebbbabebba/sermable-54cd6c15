import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

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
  onWordTap?: (index: number) => void;
}

// Smooth easing for a calmer, gliding pulse feel
const smoothTransition = { duration: 0.28, ease: "easeInOut" as const };
const layoutTransition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

const SentenceDisplay = ({
  text,
  hiddenWordIndices,
  currentWordIndex,
  spokenIndices,
  hesitatedIndices,
  missedIndices,
  onWordTap,
}: SentenceDisplayProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  const words = text.split(/\s+/).filter(w => w.trim());

  // The blue pulse must reflect the actual cursor position only. Any visual
  // lookahead makes it feel like the app has moved to words the speaker has
  // not reached yet, especially when recognition emits delayed chunks.
  const pulseIndex = currentWordIndex;


  // Auto-scroll to the pulsing word with smooth behavior
  useEffect(() => {
    if (currentWordRef.current && containerRef.current) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
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
          layout="position"
          initial={false}
          animate={{
            opacity: state.isSpoken ? 0.4 : 1,
            scale: state.isCurrent && !state.isSpoken ? [1, 1.06, 1] : 1,
          }}
          transition={{
            opacity: { duration: 0.15 },
            scale: state.isCurrent && !state.isSpoken
              ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.15 },
            layout: { duration: 0.15, ease: "easeOut" },
          }}
          className={cn(
            "inline-flex items-center justify-center mx-1 px-3 py-0.5 rounded-full text-base align-middle",
            state.isCurrent && !state.isSpoken
              ? "bg-primary/15 text-primary ring-1 ring-primary/40 font-semibold"
              : state.isSpoken
                ? "bg-muted/40 text-muted-foreground/60"
                : "bg-primary/10 text-primary",
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
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer",
            "bg-destructive/20 text-destructive font-medium ring-1 ring-destructive/40"
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
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer",
            "bg-warning/20 text-warning font-medium ring-1 ring-warning/40"
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
          layout="position"
          animate={state.isCurrent ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{
            layout: { duration: 0.15, ease: "easeOut" },
            scale: state.isCurrent
              ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.15 },
          }}
          className={cn(
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer transition-colors duration-200",
            state.isCurrent &&
              "ring-2 ring-primary bg-primary/20 text-primary font-semibold shadow-[0_0_12px_hsl(var(--primary)/0.4)]",
            !state.isCurrent && "text-muted-foreground/60 hover:bg-muted"
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
        layout="position"
        initial={false}
        animate={{
          opacity: state.isSpoken ? 0.35 : 1,
          scale: state.isCurrent && !state.isSpoken ? 1.03 : 1,
          y: 0,
        }}
        transition={{
          opacity: { duration: 0.15, ease: "easeOut" },
          scale: { duration: 0.15, ease: "easeOut" },
          layout: { duration: 0.15, ease: "easeOut" },
        }}
        className={cn(
          "inline-block mx-0.5 px-1 py-0.5 rounded transition-colors duration-200",
          // Subtle marker for current word (blue pulse)
          state.isCurrent && !state.isSpoken && "relative text-primary font-medium bg-primary/10 border-b-2 border-primary/60",
          // Spoken word gets muted styling (gray)
          state.isSpoken && "text-muted-foreground/50",
          // Missed visible word (red)
          state.isMissed && "bg-destructive/20 text-destructive",
          // Hesitated visible word (yellow)
          state.isHesitated && !state.isMissed && "bg-warning/20 text-warning",
        )}
      >
        {state.text}
        {/* Subtle pulse indicator for current word */}
        {state.isCurrent && !state.isSpoken && (
          <motion.span
            className="absolute -bottom-2 left-1/2 w-1.5 h-1.5 rounded-full bg-primary"
            initial={{ opacity: 0.6, scale: 0.8 }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
            style={{ transform: 'translateX(-50%)' }}
          />
        )}
      </motion.span>
    );
  };


  return (
    <LayoutGroup>
      <div
        ref={containerRef}
        className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-center p-6 select-none"
      >
        <AnimatePresence mode="sync">
          {words.map((_, index) => renderWord(index))}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
};

export default SentenceDisplay;
