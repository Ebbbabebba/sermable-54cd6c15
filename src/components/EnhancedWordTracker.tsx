import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AnimationStyle } from "./PracticeSettings";

interface EnhancedWordTrackerProps {
  text: string;
  isRecording: boolean;
  language: string;
  revealSpeed: number;
  showWordOnPause: boolean;
  animationStyle: AnimationStyle;
  keywordMode: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

interface WordState {
  text: string;
  isSpoken: boolean;
  isCurrent: boolean;
  isRevealed: boolean;
  isParagraphStart: boolean;
  isKeyword: boolean; // Whether this word is a keyword (always visible)
  manuallyRevealed: boolean; // Whether user tapped to reveal this word
  status?: 'correct' | 'hesitated' | 'missed'; // Track performance
  timeToSpeak?: number; // Time taken to speak this word
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

// Helper to determine if a word should be a keyword
const isKeywordWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
  // Keywords: longer words (>5 chars), or words with capitals, or important punctuation
  return cleanWord.length > 5 || /[A-Z]/.test(word) || /[.!?]/.test(word);
};

const EnhancedWordTracker = ({
  text,
  isRecording,
  language,
  revealSpeed,
  showWordOnPause,
  animationStyle,
  keywordMode,
  onTranscriptUpdate,
  className,
}: EnhancedWordTrackerProps) => {
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(Date.now());
  const [wordStartTime, setWordStartTime] = useState<number>(Date.now());
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout>();
  const currentWordIndexRef = useRef<number>(-1);
  const missedWordTimerRef = useRef<NodeJS.Timeout>();

  // Keep ref in sync with state
  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  // Initialize word states
  useEffect(() => {
    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]\s+/);
    let wordIndex = 0;
    const paragraphStarts = new Set<number>();

    sentences.forEach((sentence) => {
      const sentenceWords = sentence.trim().split(/\s+/).filter(Boolean);
      if (sentenceWords.length > 0) {
        paragraphStarts.add(wordIndex);
        wordIndex += sentenceWords.length;
      }
    });

    setWordStates(
      words.map((word, index) => ({
        text: word,
        isSpoken: false,
        isCurrent: false,
        isRevealed: false,
        isParagraphStart: paragraphStarts.has(index),
        isKeyword: isKeywordWord(word),
        manuallyRevealed: false,
      }))
    );
  }, [text]);

  // Setup speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('❌ Speech recognition not supported in this browser/device (iPad Safari has limited support)');
      console.info('ℹ️ Word tracking will be available after recording completes via AI analysis');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    console.info('✅ Speech recognition initialized with language:', language);
    console.info('📝 Total words in text:', wordStates.length);

    recognition.onresult = (event: any) => {
      let transcript = '';
      let isFinal = false;
      
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
        }
      }

      setLastSpeechTime(Date.now());
      if (onTranscriptUpdate) {
        onTranscriptUpdate(transcript);
      }

      console.log('🎤 Transcript received:', transcript);
      console.log('📝 Is final:', isFinal);
      console.log('📍 Current word index:', currentWordIndexRef.current);

      // Process spoken words with Nordic character support
      const spokenWords = transcript.toLowerCase().split(/\s+/);
      const normalizedSpoken = spokenWords.map(normalizeNordic);

      setWordStates((prev) => {
        const updated = [...prev];
        let nextIndex = currentWordIndexRef.current;

        // Only check if the CURRENT word (in sequence) matches the spoken words
        if (nextIndex >= 0 && nextIndex < updated.length) {
          const currentWord = updated[nextIndex];
          const normalizedCurrentWord = normalizeNordic(currentWord.text);
          
          console.log('🔍 Checking word:', currentWord.text);
          console.log('🔤 Normalized current:', normalizedCurrentWord);
          console.log('🗣️ Spoken words:', normalizedSpoken);
          
          // Check if any of the recently spoken words match the current word
          const matchFound = normalizedSpoken.some(spoken => {
            const cleanSpoken = spoken.trim();
            if (!cleanSpoken) return false;
            
            const matches = cleanSpoken === normalizedCurrentWord || 
                   cleanSpoken.includes(normalizedCurrentWord) || 
                   normalizedCurrentWord.includes(cleanSpoken);
            
            if (matches) {
              console.log('✅ Match found! Spoken:', cleanSpoken, 'Expected:', normalizedCurrentWord);
            }
            
            return matches;
          });

          if (matchFound && !currentWord.isSpoken) {
            const timeToSpeak = Date.now() - wordStartTime;
            console.log('🎯 Marking word as spoken:', currentWord.text, 'Time taken:', timeToSpeak, 'ms');
            
            // Determine status based on timing
            let status: 'correct' | 'hesitated' | 'missed' = 'correct';
            if (timeToSpeak > 2000) {
              status = 'hesitated'; // Yellow if took more than 2 seconds
            }
            
            // Mark current word as spoken with status
            updated[nextIndex] = {
              ...currentWord,
              isSpoken: true,
              isRevealed: true,
              isCurrent: false,
              status,
              timeToSpeak,
            };

            // Move to next word
            nextIndex = nextIndex + 1;
            
            // Set the new current word and start timer
            if (nextIndex < updated.length) {
              updated.forEach((w, i) => {
                updated[i] = { ...w, isCurrent: i === nextIndex };
              });
              setCurrentWordIndex(nextIndex);
              setWordStartTime(Date.now());
              console.log('➡️ Moving to next word index:', nextIndex);
              
              // Start timer to mark as missed if not spoken within 4 seconds
              if (missedWordTimerRef.current) {
                clearTimeout(missedWordTimerRef.current);
              }
              missedWordTimerRef.current = setTimeout(() => {
                setWordStates((prev) => {
                  const newUpdated = [...prev];
                  if (newUpdated[nextIndex] && !newUpdated[nextIndex].isSpoken) {
                    console.log('❌ Word missed (timeout):', newUpdated[nextIndex].text);
                    newUpdated[nextIndex] = {
                      ...newUpdated[nextIndex],
                      status: 'missed',
                      isRevealed: true,
                    };
                  }
                  return newUpdated;
                });
              }, 4000);
            }
          }
        }

        return updated;
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.error('❌ Speech recognition error:', event.error);
      }
    };

    recognition.onstart = () => {
      console.info('🎙️ Speech recognition started and listening...');
      console.info('📊 Current word index:', currentWordIndexRef.current);
      console.info('📝 Expected next word:', wordStates[currentWordIndexRef.current + 1]?.text || 'N/A');
    };

    recognition.onend = () => {
      console.info('🛑 Speech recognition ended');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, onTranscriptUpdate]);

  // Handle recording state
  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      setWordStates((prev) => prev.map((w, i) => ({ 
        ...w, 
        isSpoken: false, 
        isCurrent: i === 0, 
        isRevealed: false,
        manuallyRevealed: false,
        status: undefined,
        timeToSpeak: undefined,
      })));
      setCurrentWordIndex(0);
      setLastSpeechTime(Date.now());
      setWordStartTime(Date.now());
      
      try {
        recognitionRef.current.start();
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('❌ Failed to start speech recognition:', error);
      }
    } else if (!isRecording && recognitionRef.current) {
      // Clear timers
      if (missedWordTimerRef.current) {
        clearTimeout(missedWordTimerRef.current);
      }
      
      // Delay stopping to allow final results to be processed
      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
            console.log('⏹️ Speech recognition stopped');
          }
        } catch (error) {
          console.error('❌ Failed to stop speech recognition:', error);
        }
      }, 500);
    }
  }, [isRecording]);

  // Auto-reveal on pause
  useEffect(() => {
    if (!showWordOnPause || !isRecording || currentWordIndex < 0) {
      return;
    }

    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    const currentWord = wordStates[currentWordIndex];
    if (!currentWord || currentWord.isRevealed) {
      return;
    }

    // Calculate reveal delay based on speed setting and position
    const baseDelay = currentWord.isParagraphStart ? 10000 : 3000;
    const speedMultiplier = 1 - (revealSpeed - 1) / 9; // 1 = fast, 10 = slow
    const delay = baseDelay * speedMultiplier;

    pauseTimerRef.current = setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - lastSpeechTime;
      if (timeSinceLastSpeech >= delay * 0.9) {
        revealCurrentWord();
      }
    }, delay);

    return () => {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }
    };
  }, [currentWordIndex, lastSpeechTime, showWordOnPause, isRecording, revealSpeed, wordStates]);

  // Tap to reveal individual word
  const handleWordTap = useCallback((index: number) => {
    if (!keywordMode || isRecording) return;
    
    setWordStates((prev) => {
      const updated = [...prev];
      if (index >= 0 && index < updated.length && !updated[index].isKeyword) {
        updated[index] = {
          ...updated[index],
          manuallyRevealed: true,
        };
      }
      return updated;
    });
  }, [keywordMode, isRecording]);

  // Tap to reveal current word during recording
  const handleTapToReveal = useCallback(() => {
    if (isRecording && currentWordIndex >= 0) {
      revealCurrentWord();
    }
  }, [isRecording, currentWordIndex]);

  const revealCurrentWord = useCallback(() => {
    setWordStates((prev) => {
      const updated = [...prev];
      if (currentWordIndex >= 0 && currentWordIndex < updated.length) {
        updated[currentWordIndex] = {
          ...updated[currentWordIndex],
          isRevealed: true,
        };
      }
      return updated;
    });
  }, [currentWordIndex]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIndex >= 0 && containerRef.current) {
      const currentElement = containerRef.current.querySelector(`[data-word-index="${currentWordIndex}"]`);
      if (currentElement) {
        currentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentWordIndex]);

  const getWordClassName = (word: WordState, index: number) => {
    const base = "inline-block px-3 py-1.5 mx-1 my-1 rounded-md font-medium transition-all duration-200";
    
    // In keyword mode, hidden words show as dots
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.isSpoken && !isRecording) {
      return cn(
        base,
        "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600",
        "text-center min-w-[60px]"
      );
    }
    
    // Color based on performance status
    if (word.status === 'correct') {
      return cn(
        base,
        "bg-blue-500 text-white shadow-sm", // Blue for correct
        animationStyle === 'playful' && "animate-fill-in",
        animationStyle === 'energetic' && "animate-fill-in",
        animationStyle === 'minimal' && "animate-fade-in-up"
      );
    }
    
    if (word.status === 'hesitated') {
      return cn(
        base,
        "bg-yellow-500 text-white shadow-sm", // Yellow for hesitated
        animationStyle === 'playful' && "animate-fill-in",
        animationStyle === 'energetic' && "animate-fill-in",
        animationStyle === 'minimal' && "animate-fade-in-up"
      );
    }
    
    if (word.status === 'missed') {
      return cn(
        base,
        "bg-red-500 text-white shadow-sm", // Red for missed
        animationStyle === 'playful' && "animate-fill-in",
        animationStyle === 'energetic' && "animate-fill-in",
        animationStyle === 'minimal' && "animate-fade-in-up"
      );
    }

    if (word.isCurrent) {
      if (!word.isRevealed) {
        // Show word more clearly when it's current but not revealed yet
        return cn(
          base,
          "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
          "border-2 border-dashed border-gray-400",
          "cursor-pointer hover:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700"
        );
      }
      return cn(
        base,
        "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
        "border-2 border-gray-500 animate-pulse"
      );
    }

    // Show upcoming words more clearly - light gray instead of very faded
    return cn(
      base, 
      "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
    );
  };

  // Render word content - show dots for hidden words in keyword mode
  const renderWordContent = (word: WordState) => {
    if (keywordMode && !word.isKeyword && !word.manuallyRevealed && !word.isSpoken && !isRecording) {
      return "•••";
    }
    return word.text;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative max-h-[65vh] overflow-y-auto scroll-smooth",
        "bg-white dark:bg-gray-900 rounded-2xl shadow-lg",
        "p-8 md:p-12",
        className
      )}
      onClick={handleTapToReveal}
    >
      {/* Recording Status Banner */}
      {isRecording && (
        <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse flex items-center gap-2 z-10">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span className="font-medium">RECORDING - Speak clearly</span>
          {recognitionRef.current && (
            <span className="text-xs opacity-90 ml-auto">
              Word {currentWordIndex + 1} of {wordStates.length}
            </span>
          )}
          {!recognitionRef.current && (
            <span className="text-xs opacity-90 ml-auto">
              Live tracking unavailable on this device
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-1 leading-loose mt-16">
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
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {renderWordContent(word)}
          </span>
        ))}
      </div>
      
      {isRecording && recognitionRef.current && currentWordIndex >= 0 && !wordStates[currentWordIndex]?.isRevealed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-600 dark:text-gray-300 animate-fade-in bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-full shadow-sm">
          💡 Tap anywhere to reveal the next word
        </div>
      )}
      {isRecording && !recognitionRef.current && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-600 dark:text-gray-300 animate-fade-in bg-white/90 dark:bg-gray-800/90 px-4 py-2 rounded-full shadow-sm">
          📱 Word tracking after recording on iPad • AI will analyze your speech
        </div>
      )}
    </div>
  );
};

export default EnhancedWordTracker;
