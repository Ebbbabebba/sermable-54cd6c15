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
  const interimTranscript = useRef<string>("");

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

  // Removed old transcription processing - now only using accumulated final transcripts

  // Initialize OpenAI Realtime transcription
  useEffect(() => {
    const transcriber = new RealtimeTranscriber(
      (transcriptText, isFinal) => {
        if (isFinal) {
          console.log('📝 FINAL transcript:', transcriptText);
          accumulatedTranscript.current = transcriptText;
          
          // Update parent component with full transcript
          if (onTranscriptUpdate) {
            onTranscriptUpdate(transcriptText);
          }
        } else {
          console.log('⏳ Interim transcript:', transcriptText);
          interimTranscript.current = transcriptText;
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

  // Process accumulated transcript ONLY on final results - process every 500ms for better accuracy
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

        // Find the LAST confirmed spoken word index
        let lastConfirmedIndex = lastSpokenIndexRef.current;
        
        // Start checking from the word AFTER the last confirmed word
        let checkIndex = lastConfirmedIndex + 1;

        // CRITICAL: Only match words IN ORDER, one at a time
        // We track our position in BOTH the transcript and the target text
        let transcriptPosition = 0;
        
        // First, count how many target words we've already matched
        let alreadyMatchedCount = 0;
        for (let i = 0; i <= lastConfirmedIndex; i++) {
          if (updatedStates[i].spoken) alreadyMatchedCount++;
        }
        
        // Skip past already-matched words in transcript
        transcriptPosition = alreadyMatchedCount;

        // Now process REMAINING transcribed words against REMAINING target words
        while (checkIndex < targetWords.length && transcriptPosition < transcribedWords.length) {
          const targetWord = targetWords[checkIndex];
          const transcribedWord = transcribedWords[transcriptPosition];
          
          // Check if current transcript word matches current target word
          if (isSimilarWord(transcribedWord, targetWord)) {
            // MATCH! This word was spoken correctly
            const timeAtWord = wordTimestamps.current.get(checkIndex);
            const hesitated = timeAtWord ? (now - timeAtWord) >= 4000 : false; // More lenient: 4 seconds
            
            console.log(`✅ Word #${checkIndex} "${updatedStates[checkIndex].text}" matched transcript word "${transcribedWord}"`);
            
            // Mark as spoken with correct/hesitated status
            updatedStates[checkIndex] = {
              ...updatedStates[checkIndex],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus: hesitated ? 'hesitated' : 'correct'
            };
            
            lastSpokenIndexRef.current = checkIndex;
            wordTimestamps.current.delete(checkIndex);
            
            // Move both pointers forward
            checkIndex++;
            transcriptPosition++;
            continue;
          }
          
          // NO MATCH - Check if we should mark as missed
          // Look ahead ONLY 2 words in transcript to see if target word appears there
          let foundTargetAhead = false;
          for (let lookahead = transcriptPosition + 1; lookahead < Math.min(transcriptPosition + 3, transcribedWords.length); lookahead++) {
            if (isSimilarWord(transcribedWords[lookahead], targetWord)) {
              foundTargetAhead = true;
              break;
            }
          }
          
          // If we found the target word ahead in transcript, that means current transcript word was NOT in target
          // This means the user spoke something extra or the transcript picked up noise
          // Just skip this transcript word and try next one
          if (foundTargetAhead) {
            console.log(`⏩ Skipping transcript word "${transcribedWord}" - not in target`);
            transcriptPosition++;
            continue;
          }
          
          // Check if transcript word matches a FUTURE target word (skip detection)
          // Only look ahead 2 words in target to be conservative
          let matchedFutureTarget = false;
          let futureTargetIndex = -1;
          
          for (let futureIdx = checkIndex + 1; futureIdx < Math.min(checkIndex + 3, targetWords.length); futureIdx++) {
            if (isSimilarWord(transcribedWord, targetWords[futureIdx])) {
              matchedFutureTarget = true;
              futureTargetIndex = futureIdx;
              break;
            }
          }
          
          // ONLY mark as missed if we have STRONG evidence (matched a future target)
          if (matchedFutureTarget && futureTargetIndex !== -1) {
            console.log(`❌ Word #${checkIndex} "${updatedStates[checkIndex].text}" SKIPPED - found #${futureTargetIndex} "${updatedStates[futureTargetIndex].text}" in transcript`);
            
            // Mark the skipped word as MISSED
            updatedStates[checkIndex] = {
              ...updatedStates[checkIndex],
              spoken: false,
              revealed: true,
              performanceStatus: 'missed'
            };
            wordTimestamps.current.delete(checkIndex);
            
            // Mark the future matched word
            const timeAtWord = wordTimestamps.current.get(futureTargetIndex);
            const hesitated = timeAtWord ? (now - timeAtWord) >= 4000 : false;
            
            updatedStates[futureTargetIndex] = {
              ...updatedStates[futureTargetIndex],
              spoken: true,
              revealed: true,
              isCurrent: false,
              performanceStatus: hesitated ? 'hesitated' : 'correct'
            };
            
            lastSpokenIndexRef.current = futureTargetIndex;
            wordTimestamps.current.delete(futureTargetIndex);
            
            // Move past both the missed word and the matched word
            checkIndex = futureTargetIndex + 1;
            transcriptPosition++;
            continue;
          }
          
          // No clear match or skip detected - just break and wait for more transcript
          // This prevents false positives from incomplete transcripts
          break;
        }

        // Update current word indicator (blue pulse) - show on NEXT unspoken word
        let currentIdx = -1;
        for (let i = 0; i < updatedStates.length; i++) {
          if (!updatedStates[i].spoken && updatedStates[i].performanceStatus !== 'missed') {
            currentIdx = i;
            break;
          }
        }
        
        // Track timestamp for hesitation detection ONLY when we reach a NEW word
        if (currentIdx !== -1 && !wordTimestamps.current.has(currentIdx)) {
          wordTimestamps.current.set(currentIdx, now);
          console.log(`🔵 Now tracking word #${currentIdx} "${updatedStates[currentIdx].text}"`);
        }
        
        if (currentIdx !== -1) {
          setCurrentWordIndex(currentIdx);
          currentWordIndexRef.current = currentIdx;
        }
        
        // Apply current word indicator - blue pulse shows on next unspoken word
        return updatedStates.map((state, idx) => ({
          ...state,
          isCurrent: idx === currentIdx && currentIdx !== -1 && !state.spoken
        }));
      });
    }, 500); // Process every 500ms for better accuracy

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
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-100 ease-out";
    
    // Priority order: Current (reading now) > Missed > Hesitated > Correct > Default
    
    // Current word being READ - bright blue highlight (shows while reading)
    // This appears BEFORE any correctness evaluation
    if (word.isCurrent && isRecording && !word.spoken) {
      return cn(
        base,
        "bg-blue-500 text-white scale-110 shadow-lg ring-4 ring-blue-400/60 animate-pulse font-bold"
      );
    }
    
    // AFTER word is fully spoken and confirmed by OpenAI:
    
    // Missed/Skipped - RED (word was skipped based on final transcript)
    if (word.performanceStatus === 'missed') {
      return cn(
        base,
        "bg-red-500 text-white shadow-sm line-through"
      );
    }
    
    // Hesitated - YELLOW (took 3+ seconds, confirmed by final transcript)
    if (word.performanceStatus === 'hesitated') {
      return cn(
        base,
        "bg-yellow-500 text-white shadow-sm"
      );
    }
    
    // Correct - GREEN (spoken correctly, confirmed by final transcript)
    if (word.spoken && word.performanceStatus === 'correct') {
      return cn(
        base,
        "bg-green-500 text-white shadow-md"
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

    // Default - unspoken word (no evaluation yet)
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
