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
  onWordTap?: (index: number) => void;
}

// Smooth spring config for word transitions
const wordSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
  mass: 0.8,
};

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
  
  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordRef.current && containerRef.current) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [currentWordIndex]);

  const getWordState = (index: number): WordState => {
    const word = words[index];
    const isVisible = !hiddenWordIndices.has(index);
    const isSpoken = spokenIndices.has(index);
    const isCurrent = index === currentWordIndex;
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

  const renderWord = (index: number) => {
    const state = getWordState(index);
    
    // Hidden word that was MISSED - reveal it in red so user can see what they got wrong
    if (!state.isVisible && state.isMissed) {
      return (
        <motion.span
          key={`${index}-missed`}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={wordSpring}
          className={cn(
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer",
            "bg-destructive/20 text-destructive font-medium ring-1 ring-destructive/40"
          )}
        >
          {state.text}
        </motion.span>
      );
    }
    
    // Hidden word that was HESITATED - reveal it in yellow/warning
    if (!state.isVisible && state.isHesitated) {
      return (
        <motion.span
          key={`${index}-hesitated`}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={wordSpring}
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
          layout
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn(
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer",
            state.isCurrent && "ring-1 ring-primary/50 bg-primary/10",
            !state.isCurrent && "text-muted-foreground hover:bg-muted"
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
        layout
        initial={false}
        animate={{
          opacity: state.isSpoken ? 0.4 : 1,
          scale: state.isCurrent && !state.isSpoken ? 1.02 : 1,
        }}
        transition={{
          opacity: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
          scale: { duration: 0.3, ease: "easeOut" },
          layout: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
        }}
        className={cn(
          "inline-block mx-0.5 px-1 py-0.5 rounded",
          // Subtle marker for current word
          state.isCurrent && !state.isSpoken && "relative text-primary font-medium bg-primary/10 border-b-2 border-primary/60 after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary after:animate-pulse",
          // Spoken word gets muted styling
          state.isSpoken && "text-muted-foreground",
          // Missed visible word (not hidden)
          state.isMissed && "bg-destructive/20 text-destructive",
          // Hesitated visible word (not hidden)
          state.isHesitated && !state.isMissed && "bg-warning/20 text-warning",
        )}
      >
        {state.text}
      </motion.span>
    );
  };

  return (
    <div
      ref={containerRef}
      className="text-xl md:text-2xl lg:text-3xl leading-relaxed text-center p-6 select-none"
    >
      {words.map((_, index) => renderWord(index))}
    </div>
  );
};

export default SentenceDisplay;
