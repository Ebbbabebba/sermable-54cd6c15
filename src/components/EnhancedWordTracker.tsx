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
    .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž\s]/gi, ''); // Keep spaces!
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

  // Process transcription instantly - fast word-by-word highlighting
  useEffect(() => {
    if (!transcription || transcription.trim() === '') return;

    const transcribedWords = transcription.toLowerCase().split(/\s+/).filter(Boolean);
    if (transcribedWords.length === 0) return;

    setWordStates(prevStates => {
      const newStates = [...prevStates];
      let lastMatchedIndex = currentWordIndexRef.current;

      // Process each transcribed word instantly
      for (let i = 0; i < transcribedWords.length; i++) {
        const transcribedWord = normalizeNordic(transcribedWords[i].replace(/[^\w]/g, ''));
        if (!transcribedWord) continue;

        // Find the next matching word in the text
        let foundMatch = false;
        for (let j = lastMatchedIndex; j < newStates.length; j++) {
          const targetWord = normalizeNordic(newStates[j].text.toLowerCase().replace(/[^\w]/g, ''));
          
          if (isSimilarWord(transcribedWord, targetWord)) {
            // Instantly mark as spoken with correct status
            newStates[j] = {
              ...newStates[j],
              spoken: true,
              isCurrent: false,
              performanceStatus: 'correct',
              revealed: true
            };

            foundMatch = true;
            lastMatchedIndex = j + 1;
            lastSpokenIndexRef.current = j;
            break;
          }
        }
      }

      // Find the current (next unspoken) word
      let currentIdx = -1;
      for (let i = 0; i < newStates.length; i++) {
        if (!newStates[i].spoken) {
          currentIdx = i;
          newStates[i] = { ...newStates[i], isCurrent: true };
          break;
        }
      }

      if (currentIdx !== -1) {
        setCurrentWordIndex(currentIdx);
        currentWordIndexRef.current = currentIdx;
      }

      return newStates;
    });
  }, [transcription]);

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
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-150 ease-out";
    
    // Current word being spoken - bright blue highlight
    if (word.isCurrent && isRecording) {
      return cn(
        base,
        "bg-blue-500 text-white scale-110 shadow-lg ring-2 ring-blue-400/50 animate-pulse"
      );
    }
    
    // Spoken words - instant green success state
    if (word.spoken && word.performanceStatus === 'correct') {
      return cn(
        base,
        "bg-green-500 text-white shadow-md"
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

    // In keyword mode, hidden words show as dots
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.spoken && !isRecording) {
      return cn(
        base,
        "bg-muted text-muted-foreground cursor-pointer hover:bg-accent hover:text-accent-foreground",
        "text-center min-w-[60px]"
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
        <div className="mb-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium text-center">
            🎤 Listening - Speak clearly and words will light up as you go
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
