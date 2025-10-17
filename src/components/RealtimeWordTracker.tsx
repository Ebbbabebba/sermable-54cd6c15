import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface RealtimeWordTrackerProps {
  text: string;
  transcript: string;
  className?: string;
}

const RealtimeWordTracker = ({ 
  text, 
  transcript,
  className 
}: RealtimeWordTrackerProps) => {
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [currentWord, setCurrentWord] = useState<string>("");
  const words = text.split(/(\s+)/);

  // Update spoken words whenever transcript changes
  useEffect(() => {
    if (!transcript) {
      setSpokenWords(new Set());
      setCurrentWord("");
      return;
    }

    // Extract words and mark as spoken
    const transcriptWords = transcript.toLowerCase().split(/\s+/);
    const newSpokenWords = new Set<string>();
    
    transcriptWords.forEach(word => {
      const cleanWord = word.replace(/[^\w]/g, '');
      if (cleanWord) {
        newSpokenWords.add(cleanWord);
      }
    });
    
    setSpokenWords(newSpokenWords);
    
    // Track current word being spoken
    if (transcriptWords.length > 0) {
      setCurrentWord(transcriptWords[transcriptWords.length - 1].replace(/[^\w]/g, ''));
    }
  }, [transcript]);

  const getWordStyle = (word: string) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    if (!cleanWord) return "text-foreground/80";
    
    if (currentWord === cleanWord) {
      return "bg-success/20 text-success font-bold scale-110 animate-popIn";
    }
    
    if (spokenWords.has(cleanWord)) {
      return "bg-success/30 text-success-dark font-semibold";
    }
    
    return "text-muted-foreground/60";
  };

  return (
    <div className={cn("prose prose-2xl max-w-none leading-loose text-2xl", className)}>
      {words.map((word, index) => {
        if (/^\s+$/.test(word)) {
          return <span key={index}>{word}</span>;
        }
        
        return (
          <span
            key={index}
            className={cn(
              "inline-block px-1.5 py-0.5 rounded-md transition-all duration-300",
              getWordStyle(word)
            )}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

export default RealtimeWordTracker;
