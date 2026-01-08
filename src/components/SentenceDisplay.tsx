import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

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
    
    // Hidden word - show as dots
    if (!state.isVisible && !state.isSpoken) {
      const dotCount = Math.ceil(state.text.length / 2);
      return (
        <span
          key={index}
          ref={state.isCurrent ? currentWordRef : undefined}
          onClick={() => onWordTap?.(index)}
          className={cn(
            "inline-block mx-1 px-2 py-0.5 rounded cursor-pointer transition-all duration-300",
            state.isCurrent && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background animate-pulse",
            state.isHesitated && "bg-yellow-500/30 text-yellow-300",
            state.isMissed && "bg-red-500/30 text-red-300",
            !state.isHesitated && !state.isMissed && "text-muted-foreground hover:bg-muted"
          )}
        >
          {'•'.repeat(dotCount)}
        </span>
      );
    }
    
    // Visible or spoken word
    return (
      <span
        key={index}
        ref={state.isCurrent ? currentWordRef : undefined}
        className={cn(
          "inline-block mx-0.5 px-1 py-0.5 rounded transition-all duration-300",
          // Blue pulse for current word
          state.isCurrent && !state.isSpoken && [
            "relative",
            "text-blue-400 font-semibold",
            "after:absolute after:inset-0 after:rounded after:animate-ping after:bg-blue-500/30",
          ],
          // Spoken word fades
          state.isSpoken && "text-muted-foreground/40",
          // Hidden words that reappeared due to miss/hesitation
          !state.isVisible && state.isSpoken && state.isHesitated && "bg-yellow-500/20 text-yellow-300",
          !state.isVisible && state.isSpoken && state.isMissed && "bg-red-500/20 text-red-300",
        )}
      >
        {state.text}
      </span>
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
