import { useRef, useEffect, useState } from "react";
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

// Smooth easing for natural feel
const smoothTransition = { duration: 0.4, ease: "easeOut" as const };

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
  const [displayedIndex, setDisplayedIndex] = useState(currentWordIndex);
  
  const words = text.split(/\s+/).filter(w => w.trim());
  
  // Smooth transition for current word index with slight delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedIndex(currentWordIndex);
    }, 50); // Small delay for smoother visual transition
    return () => clearTimeout(timer);
  }, [currentWordIndex]);
  
  // Auto-scroll to current word with smooth behavior
  useEffect(() => {
    if (currentWordRef.current && containerRef.current) {
      currentWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [displayedIndex]);

  const getWordState = (index: number): WordState => {
    const word = words[index];
    const isVisible = !hiddenWordIndices.has(index);
    const isSpoken = spokenIndices.has(index);
    const isCurrent = index === displayedIndex;
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
    
    // Hidden word that was HESITATED - reveal it in yellow/warning
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
          transition={{ 
            layout: { duration: 0.3, ease: "easeOut" },
          }}
          className={cn(
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer transition-colors duration-300",
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
        layout="position"
        initial={false}
        animate={{
          opacity: state.isSpoken ? 0.35 : 1,
          scale: state.isCurrent && !state.isSpoken ? 1.03 : 1,
          y: 0,
        }}
        transition={{
          opacity: { duration: 0.5, ease: "easeOut" },
          scale: { duration: 0.25, ease: "easeOut" },
          layout: { duration: 0.3, ease: "easeOut" },
        }}
        className={cn(
          "inline-block mx-0.5 px-1 py-0.5 rounded transition-colors duration-200",
          // Subtle marker for current word
          state.isCurrent && !state.isSpoken && "relative text-primary font-medium bg-primary/10 border-b-2 border-primary/60",
          // Spoken word gets muted styling
          state.isSpoken && "text-muted-foreground/50",
          // Missed visible word (not hidden)
          state.isMissed && "bg-destructive/20 text-destructive",
          // Hesitated visible word (not hidden)
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
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
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
