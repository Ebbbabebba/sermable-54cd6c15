import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AnimationStyle } from "./PracticeSettings";

interface EnhancedWordTrackerProps {
  text: string;
  isRecording: boolean;
  transcription?: string;
  revealSpeed: number;
  showWordOnPause: boolean;
  animationStyle: AnimationStyle;
  keywordMode: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

interface WordState {
  text: string;
  spoken: boolean;
  isCurrent: boolean;
  revealed: boolean;
  isKeyword: boolean;
  manuallyRevealed: boolean;
  performanceStatus?: 'correct' | 'hesitated' | 'missed';
  timeToSpeak?: number;
}

const normalizeNordic = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/[öø]/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/ð/g, 'd')
    .replace(/þ/g, 'th')
    .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž]/gi, '');
};

// Stricter word similarity checking - only match if words are actually similar
const isSimilarWord = (word1: string, word2: string): boolean => {
  const w1 = normalizeNordic(word1);
  const w2 = normalizeNordic(word2);
  
  // Must be at least 3 characters to match
  if (w1.length < 3 || w2.length < 3) {
    return w1 === w2; // Short words must match exactly
  }
  
  // Exact match
  if (w1 === w2) return true;
  
  // One starts with the other (for truncated pronunciations) - but must be at least 70% of length
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen / maxLen >= 0.7) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return true;
  }
  
  // Levenshtein-like distance for similar sounding words - stricter threshold
  let differences = 0;
  const length = Math.min(w1.length, w2.length);
  for (let i = 0; i < length; i++) {
    if (w1[i] !== w2[i]) differences++;
  }
  differences += Math.abs(w1.length - w2.length);
  
  // Allow up to 20% character differences only (much stricter)
  return differences / maxLen <= 0.2;
};

const isKeywordWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
  return cleanWord.length > 5 || /[A-Z]/.test(word) || /[.!?]/.test(word);
};

const EnhancedWordTracker = ({
  text,
  isRecording,
  transcription = "",
  revealSpeed,
  showWordOnPause,
  animationStyle,
  keywordMode,
  onTranscriptUpdate,
  className,
}: EnhancedWordTrackerProps) => {
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const currentWordIndexRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpokenIndexRef = useRef(-1);
  const wordTimestamps = useRef<Map<number, number>>(new Map()); // Track when each word position was reached

  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  // Initialize word states from text
  useEffect(() => {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const initialStates: WordState[] = words.map(word => ({
      text: word,
      spoken: false,
      isCurrent: false,
      revealed: !keywordMode || isKeywordWord(word),
      isKeyword: isKeywordWord(word),
      manuallyRevealed: false,
      performanceStatus: undefined,
      timeToSpeak: 0
    }));
    setWordStates(initialStates);
    setCurrentWordIndex(0);
    currentWordIndexRef.current = 0;
    lastSpokenIndexRef.current = -1;
  }, [text, keywordMode]);

  // Process transcription from Whisper - Sequential word matching with skip detection and timing
  useEffect(() => {
    if (!transcription || wordStates.length === 0) return;

    const normalizeText = (text: string) => 
      normalizeNordic(text.toLowerCase().replace(/[^\w\s]/g, ''));

    const transcribedWords = normalizeText(transcription).split(/\s+/).filter(w => w.length > 0);
    const targetWords = wordStates.map(ws => normalizeText(ws.text));

    const now = Date.now();

    // Sequential matching with skip detection and hesitation timing
    setWordStates(prevStates => {
      const updatedStates = [...prevStates];
      let currentLastSpoken = lastSpokenIndexRef.current;

      // Check each transcribed word
      for (const transcribedWord of transcribedWords) {
        const nextTargetIndex = currentLastSpoken + 1;
        
        if (nextTargetIndex >= targetWords.length) break;

        const targetWord = targetWords[nextTargetIndex];
        
        // Check if transcribed word matches next expected word
        const isMatch = isSimilarWord(transcribedWord, targetWord);

        if (isMatch && !updatedStates[nextTargetIndex].spoken) {
          // Check for hesitation (2+ seconds at this word position)
          const timeAtWord = wordTimestamps.current.get(nextTargetIndex);
          const hesitated = timeAtWord ? (now - timeAtWord) >= 2000 : false;
          
          // Mark the word as spoken and IMMEDIATELY advance
          updatedStates[nextTargetIndex] = {
            ...updatedStates[nextTargetIndex],
            spoken: true,
            revealed: true,
            performanceStatus: hesitated ? 'hesitated' : 'correct'
          };
          currentLastSpoken = nextTargetIndex;
          lastSpokenIndexRef.current = nextTargetIndex;
          wordTimestamps.current.delete(nextTargetIndex);
          
          // Continue processing more words in this transcription batch
          continue;
        } else if (!isMatch) {
          // Check if this word matches a word further ahead (skip detection)
          let foundMatch = false;
          for (let i = nextTargetIndex + 1; i < Math.min(nextTargetIndex + 3, targetWords.length); i++) {
            if (isSimilarWord(transcribedWord, targetWords[i])) {
              // Mark all skipped words as missed (RED)
              for (let j = nextTargetIndex; j < i; j++) {
                if (!updatedStates[j].spoken) {
                  updatedStates[j] = {
                    ...updatedStates[j],
                    spoken: false,
                    revealed: true,
                    performanceStatus: 'missed'
                  };
                  wordTimestamps.current.delete(j);
                }
              }
              
              // Check for hesitation on the matched word
              const timeAtWord = wordTimestamps.current.get(i);
              const hesitated = timeAtWord ? (now - timeAtWord) >= 2000 : false;
              
              // Mark the matched word as spoken and advance
              updatedStates[i] = {
                ...updatedStates[i],
                spoken: true,
                revealed: true,
                performanceStatus: hesitated ? 'hesitated' : 'correct'
              };
              currentLastSpoken = i;
              lastSpokenIndexRef.current = i;
              wordTimestamps.current.delete(i);
              foundMatch = true;
              break;
            }
          }
          
          if (foundMatch) continue;
        }
      }

      // Find next unspoken word (skip over missed words)
      let currentIdx = -1;
      for (let i = 0; i < updatedStates.length; i++) {
        if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== 'missed') {
          currentIdx = i;
          break;
        }
      }
      
      // Track timestamp when we reach a new word position
      if (currentIdx !== -1 && !wordTimestamps.current.has(currentIdx)) {
        wordTimestamps.current.set(currentIdx, now);
      }
      
      // Update isCurrent for all words
      return updatedStates.map((state, idx) => ({
        ...state,
        isCurrent: idx === currentIdx && currentIdx !== -1
      }));
    });

    // Update current word index for scrolling
    const newCurrentIdx = wordStates.findIndex(s => !s.spoken && s.performanceStatus !== 'missed');
    if (newCurrentIdx !== -1) {
      setCurrentWordIndex(newCurrentIdx);
      currentWordIndexRef.current = newCurrentIdx;
    }
  }, [transcription, wordStates]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording) {
      wordTimestamps.current.clear(); // Clear all timing data
      setWordStates(prevStates =>
        prevStates.map(state => ({
          ...state,
          spoken: false,
          isCurrent: false,
          revealed: !keywordMode || state.isKeyword || state.manuallyRevealed,
          performanceStatus: undefined,
          timeToSpeak: 0
        }))
      );
      setCurrentWordIndex(0);
      currentWordIndexRef.current = 0;
      lastSpokenIndexRef.current = -1;
    }
  }, [isRecording, keywordMode]);

  // Tap to reveal individual word
  const handleWordTap = useCallback((index: number) => {
    if (!keywordMode || isRecording) return;
    
    setWordStates((prev) => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length && !updated[index].isKeyword) {
        updated[index] = {
          ...updated[index],
          manuallyRevealed: true,
          revealed: true
        };
      }
      return updated;
    });
  }, [keywordMode, isRecording]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIndex >= 0 && scrollContainerRef.current) {
      const currentElement = scrollContainerRef.current.querySelector(`[data-word-index="${currentWordIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentWordIndex]);

  const getWordClassName = (word: WordState, index: number) => {
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-200";
    
    // In keyword mode, hidden words show as dots
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.spoken && !isRecording) {
      return cn(
        base,
        "bg-muted text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground",
        "text-center min-w-[60px]"
      );
    }
    
    // Color based on performance status using semantic tokens
    if (word.performanceStatus === 'correct') {
      return cn(
        base,
        "bg-primary text-primary-foreground shadow-sm"
      );
    }
    
    if (word.performanceStatus === 'hesitated') {
      return cn(
        base,
        "bg-warning text-warning-foreground shadow-sm"
      );
    }
    
    if (word.performanceStatus === 'missed') {
      return cn(
        base,
        "bg-destructive text-destructive-foreground shadow-sm"
      );
    }

    if (word.isCurrent) {
      return cn(
        base,
        "bg-accent text-accent-foreground border-2 border-primary animate-pulse"
      );
    }

    return cn(
      base, 
      "bg-muted text-muted-foreground"
    );
  };

  const renderWordContent = (word: WordState) => {
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.spoken && !isRecording) {
      return "•••";
    }
    return word.text;
  };

  return (
    <div
      ref={scrollContainerRef}
      className={cn(
        "relative min-h-[200px] max-h-[600px] overflow-y-auto p-8 rounded-lg bg-background/50 backdrop-blur-sm",
        className
      )}
    >
      {isRecording && (
        <div className="mb-4 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm text-primary font-medium text-center">
            🎤 Recording via Whisper API - Words will highlight as you speak
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1 leading-loose">
        {wordStates.map((word, index) => (
          <span
            key={index}
            data-word-index={index}
            className={getWordClassName(word, index)}
            onClick={(e) => {
              e.stopPropagation();
              handleWordTap(index);
            }}
            style={{
              fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {renderWordContent(word)}
          </span>
        ))}
      </div>
    </div>
  );
};

export default EnhancedWordTracker;
