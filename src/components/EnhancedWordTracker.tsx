import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AnimationStyle } from "./PracticeSettings";
import { RealtimeTranscriber } from "@/utils/RealtimeTranscription";

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

// EXACT same matching logic as analyze-speech edge function - must be identical
const isSimilarWord = (word1: string, word2: string): boolean => {
  const w1 = normalizeNordic(word1);
  const w2 = normalizeNordic(word2);
  
  // Exact match
  if (w1 === w2) return true;
  
  // Very short words must match exactly (2 chars or less)
  if (w1.length <= 2 || w2.length <= 2) {
    return w1 === w2;
  }
  
  // Prefix matching for truncated words - minimum 80% length match
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen / maxLen >= 0.8) {
    if (w1.startsWith(w2) || w2.startsWith(w1)) return true;
  }
  
  // Character-by-character similarity with strict threshold
  let matches = 0;
  const compareLength = Math.min(w1.length, w2.length);
  for (let i = 0; i < compareLength; i++) {
    if (w1[i] === w2[i]) matches++;
  }
  
  // Must have 85% character match
  const similarity = matches / Math.max(w1.length, w2.length);
  return similarity >= 0.85;
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
  const transcriberRef = useRef<RealtimeTranscriber | null>(null);
  const accumulatedTranscript = useRef<string>("");

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

  // Process transcription with instant highlighting, hesitation detection, and skip tracking
  useEffect(() => {
    if (!transcription || transcription.trim() === '') return;

    const normalizeText = (text: string) => 
      normalizeNordic(text.toLowerCase().replace(/[^\w\s]/g, ''));

    const now = Date.now();

    setWordStates(prevStates => {
      if (prevStates.length === 0) return prevStates;
      
      const transcribedWords = normalizeText(transcription).split(/\s+/).filter(w => w.length > 0);
      const targetWords = prevStates.map(ws => normalizeText(ws.text));
      
      const updatedStates = [...prevStates];
      let currentLastSpoken = lastSpokenIndexRef.current;

      // Process each transcribed word
      for (const transcribedWord of transcribedWords) {
        const nextTargetIndex = currentLastSpoken + 1;
        
        if (nextTargetIndex >= targetWords.length) break;

        const targetWord = targetWords[nextTargetIndex];
        const isMatch = isSimilarWord(transcribedWord, targetWord);

        if (isMatch && !updatedStates[nextTargetIndex].spoken) {
          // Check for hesitation (3+ seconds at this word for more lenient detection)
          const timeAtWord = wordTimestamps.current.get(nextTargetIndex);
          const hesitated = timeAtWord ? (now - timeAtWord) >= 3000 : false;
          
          // Mark as spoken - green if no hesitation, yellow if hesitated
          updatedStates[nextTargetIndex] = {
            ...updatedStates[nextTargetIndex],
            spoken: true,
            revealed: true,
            isCurrent: false,
            performanceStatus: hesitated ? 'hesitated' : 'correct'
          };
          currentLastSpoken = nextTargetIndex;
          lastSpokenIndexRef.current = nextTargetIndex;
          wordTimestamps.current.delete(nextTargetIndex);
          
          continue;
        } else if (!isMatch) {
          // Check if word matches further ahead (skip detection) - only look 2 words ahead
          let foundMatch = false;
          let matchIndex = -1;
          
          for (let i = nextTargetIndex + 1; i < Math.min(nextTargetIndex + 2, targetWords.length); i++) {
            if (isSimilarWord(transcribedWord, targetWords[i])) {
              matchIndex = i;
              foundMatch = true;
              break;
            }
          }
          
          // ONLY mark as missed if we found a clear match ahead (positive evidence of skipping)
          if (foundMatch && matchIndex !== -1) {
            // Mark the skipped word as MISSED (RED)
            updatedStates[nextTargetIndex] = {
              ...updatedStates[nextTargetIndex],
              spoken: false,
              revealed: true,
              performanceStatus: 'missed'
            };
            wordTimestamps.current.delete(nextTargetIndex);
            
            // Check for hesitation on matched word
            const timeAtWord = wordTimestamps.current.get(matchIndex);
            const hesitated = timeAtWord ? (now - timeAtWord) >= 3000 : false;
            
            // Mark the matched word
            updatedStates[matchIndex] = {
              ...updatedStates[matchIndex],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus: hesitated ? 'hesitated' : 'correct'
            };
            currentLastSpoken = matchIndex;
            lastSpokenIndexRef.current = matchIndex;
            wordTimestamps.current.delete(matchIndex);
            continue;
          }
          
          // DON'T mark as missed if no match found - just wait for next transcription batch
          // This prevents false positives from transcription delays
        }
      }

      // Find next unspoken word and track timestamp
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
      
      // Update current word index
      if (currentIdx !== -1) {
        setCurrentWordIndex(currentIdx);
        currentWordIndexRef.current = currentIdx;
      }
      
      // Update isCurrent for all words
      return updatedStates.map((state, idx) => ({
        ...state,
        isCurrent: idx === currentIdx && currentIdx !== -1
      }));
    });
  }, [transcription]);

  // Initialize OpenAI Realtime transcription
  useEffect(() => {
    const transcriber = new RealtimeTranscriber(
      (transcriptText) => {
        console.log('📝 Received transcript:', transcriptText);
        accumulatedTranscript.current = transcriptText;
        
        // Update parent component with full transcript
        if (onTranscriptUpdate) {
          onTranscriptUpdate(transcriptText);
        }
      },
      (error) => {
        console.error('❌ Transcription error:', error);
      }
    );

    transcriberRef.current = transcriber;

    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.disconnect();
      }
    };
  }, [onTranscriptUpdate]);

  // Process accumulated transcript in real-time - process every 100ms for instant feedback
  useEffect(() => {
    if (!isRecording) return;

    const intervalId = setInterval(() => {
      const transcript = accumulatedTranscript.current;
      if (!transcript || transcript.trim() === '') return;

      const normalizeText = (text: string) => 
        normalizeNordic(text.toLowerCase().replace(/[^\w\s]/g, ''));

      const now = Date.now();

      setWordStates(prevStates => {
        if (prevStates.length === 0) return prevStates;
        
        const transcribedWords = normalizeText(transcript).split(/\s+/).filter(w => w.length > 0);
        const targetWords = prevStates.map(ws => normalizeText(ws.text));
        
        const updatedStates = [...prevStates];
        let nextUnspokenIndex = -1;

        // Find the next unspoken word (this is where we are in the script)
        for (let i = 0; i < updatedStates.length; i++) {
          if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== 'missed') {
            nextUnspokenIndex = i;
            break;
          }
        }

        // CRITICAL: Only process transcribed words that match our current position or ahead
        for (let transcribedIdx = 0; transcribedIdx < transcribedWords.length; transcribedIdx++) {
          const transcribedWord = transcribedWords[transcribedIdx];
          
          // Start from next unspoken word
          if (nextUnspokenIndex === -1 || nextUnspokenIndex >= targetWords.length) break;

          const targetWord = targetWords[nextUnspokenIndex];
          const isExactMatch = isSimilarWord(transcribedWord, targetWord);

          // EXACT MATCH - color it ONLY after we have transcript evidence
          if (isExactMatch && !updatedStates[nextUnspokenIndex].spoken) {
            const timeAtWord = wordTimestamps.current.get(nextUnspokenIndex);
            const hesitated = timeAtWord ? (now - timeAtWord) >= 3000 : false;
            
            // Color word instantly after speaking
            updatedStates[nextUnspokenIndex] = {
              ...updatedStates[nextUnspokenIndex],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus: hesitated ? 'hesitated' : 'correct'
            };
            
            lastSpokenIndexRef.current = nextUnspokenIndex;
            wordTimestamps.current.delete(nextUnspokenIndex);
            
            // Move to next word
            nextUnspokenIndex++;
            continue;
          }

          // SKIP DETECTION - check if they said a word ahead (look max 2 words ahead)
          if (!isExactMatch) {
            let foundMatchAhead = false;
            let matchIndex = -1;
            
            // Look ahead max 2 words
            for (let lookAhead = 1; lookAhead <= 2 && (nextUnspokenIndex + lookAhead) < targetWords.length; lookAhead++) {
              const futureIndex = nextUnspokenIndex + lookAhead;
              if (isSimilarWord(transcribedWord, targetWords[futureIndex])) {
                matchIndex = futureIndex;
                foundMatchAhead = true;
                break;
              }
            }
            
            // If found match ahead, mark skipped word as MISSED (RED)
            if (foundMatchAhead && matchIndex !== -1) {
              // Mark current word as MISSED
              updatedStates[nextUnspokenIndex] = {
                ...updatedStates[nextUnspokenIndex],
                spoken: false,
                revealed: true,
                performanceStatus: 'missed'
              };
              wordTimestamps.current.delete(nextUnspokenIndex);
              
              // Mark the matched word ahead as CORRECT/HESITATED
              const timeAtWord = wordTimestamps.current.get(matchIndex);
              const hesitated = timeAtWord ? (now - timeAtWord) >= 3000 : false;
              
              updatedStates[matchIndex] = {
                ...updatedStates[matchIndex],
                spoken: true,
                revealed: true,
                isCurrent: false,
                performanceStatus: hesitated ? 'hesitated' : 'correct'
              };
              
              lastSpokenIndexRef.current = matchIndex;
              wordTimestamps.current.delete(matchIndex);
              
              // Move to word after the match
              nextUnspokenIndex = matchIndex + 1;
              continue;
            }
          }
        }

        // Update current word indicator (blue pulse) - only on NEXT unspoken word
        let currentIdx = -1;
        for (let i = 0; i < updatedStates.length; i++) {
          if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== 'missed') {
            currentIdx = i;
            break;
          }
        }
        
        // Track timestamp for hesitation detection ONLY when we reach a new word
        if (currentIdx !== -1 && !wordTimestamps.current.has(currentIdx)) {
          wordTimestamps.current.set(currentIdx, now);
        }
        
        if (currentIdx !== -1) {
          setCurrentWordIndex(currentIdx);
          currentWordIndexRef.current = currentIdx;
        }
        
        // Apply current word indicator - blue pulse on NEXT word to speak
        return updatedStates.map((state, idx) => ({
          ...state,
          isCurrent: idx === currentIdx && currentIdx !== -1 && !state.spoken
        }));
      });
    }, 100); // Process every 100ms for near-instant feedback

    return () => clearInterval(intervalId);
  }, [isRecording]);

  // Handle recording state changes
  useEffect(() => {
    const setupRecording = async () => {
      if (isRecording && transcriberRef.current) {
        console.log('🎤 Starting OpenAI realtime transcription');
        wordTimestamps.current.clear();
        accumulatedTranscript.current = "";
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
        
        try {
          await transcriberRef.current.connect();
          await transcriberRef.current.startRecording();
        } catch (error) {
          console.error('Error starting transcription:', error);
        }
      } else if (!isRecording && transcriberRef.current) {
        console.log('⏹️ Stopping transcription');
        transcriberRef.current.disconnect();
      }
    };

    setupRecording();
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
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-75 ease-out";
    
    // Priority order: Missed > Hesitated > Correct > Current > Default
    
    // Missed/Skipped - RED (highest priority - word was skipped)
    if (word.performanceStatus === 'missed') {
      return cn(
        base,
        "bg-red-500 text-white shadow-sm line-through"
      );
    }
    
    // Hesitated - YELLOW (took 3+ seconds)
    if (word.performanceStatus === 'hesitated') {
      return cn(
        base,
        "bg-yellow-500 text-white shadow-sm"
      );
    }
    
    // Correct - GREEN (spoken correctly without hesitation)
    if (word.spoken && word.performanceStatus === 'correct') {
      return cn(
        base,
        "bg-green-500 text-white shadow-md"
      );
    }
    
    // Current word being spoken - bright blue highlight ONLY if not yet spoken
    if (word.isCurrent && isRecording && !word.spoken) {
      return cn(
        base,
        "bg-blue-500 text-white scale-110 shadow-lg ring-2 ring-blue-400/50 animate-pulse"
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

    // Default - unspoken word
    return cn(
      base, 
      "bg-muted/50 text-muted-foreground"
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
