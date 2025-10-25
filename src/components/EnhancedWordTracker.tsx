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

  // Process transcription from Whisper
  useEffect(() => {
    if (!transcription || wordStates.length === 0) return;

    const normalizeText = (text: string) => 
      normalizeNordic(text.toLowerCase().replace(/[^\w\s]/g, ''));

    const transcribedWords = normalizeText(transcription).split(/\s+/);
    const targetWords = wordStates.map(ws => normalizeText(ws.text));

    let matchCount = 0;
    for (let i = 0; i < Math.min(transcribedWords.length, targetWords.length); i++) {
      if (transcribedWords[i] === targetWords[i]) {
        matchCount = i + 1;
      } else {
        break;
      }
    }

    if (matchCount > lastSpokenIndexRef.current) {
      setWordStates(prevStates => 
        prevStates.map((state, idx) => ({
          ...state,
          spoken: idx < matchCount,
          isCurrent: idx === matchCount,
          revealed: state.revealed || idx < matchCount,
          performanceStatus: idx < matchCount ? 'correct' : state.performanceStatus
        }))
      );
      setCurrentWordIndex(matchCount);
      currentWordIndexRef.current = matchCount;
      lastSpokenIndexRef.current = matchCount - 1;
    }
  }, [transcription, wordStates.length]);

  // Handle recording state changes
  useEffect(() => {
    if (isRecording) {
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
        "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600",
        "text-center min-w-[60px]"
      );
    }
    
    // Color based on performance status
    if (word.performanceStatus === 'correct') {
      return cn(
        base,
        "bg-blue-500 text-white shadow-sm"
      );
    }
    
    if (word.performanceStatus === 'hesitated') {
      return cn(
        base,
        "bg-yellow-500 text-white shadow-sm"
      );
    }
    
    if (word.performanceStatus === 'missed') {
      return cn(
        base,
        "bg-red-500 text-white shadow-sm"
      );
    }

    if (word.isCurrent) {
      return cn(
        base,
        "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
        "border-2 border-gray-500 animate-pulse"
      );
    }

    return cn(
      base, 
      "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
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
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium text-center">
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
