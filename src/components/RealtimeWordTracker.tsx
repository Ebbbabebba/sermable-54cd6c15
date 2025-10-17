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
    
    if (!cleanWord) return "text-muted-foreground/40";
    
    if (currentWord === cleanWord) {
      return "bg-success text-success-foreground font-extrabold scale-110 shadow-lg animate-popIn";
    }
    
    if (spokenWords.has(cleanWord)) {
      return "bg-success/80 text-success-foreground font-bold shadow-md";
    }
    
    return "text-muted-foreground/50 font-medium";
  };

  return (
    <div className={cn("max-w-4xl mx-auto text-center leading-loose", className)}>
      <div className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
        {words.map((word, index) => {
          if (/^\s+$/.test(word)) {
            return <span key={index}> </span>;
          }
          
          return (
            <span
              key={index}
              className={cn(
                "inline-block mx-1 my-2 px-3 py-2 rounded-2xl transition-all duration-300 ease-out",
                getWordStyle(word)
              )}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default RealtimeWordTracker;
