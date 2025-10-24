import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Language, AnimationStyle } from "./PracticeSettings";

interface EnhancedWordTrackerProps {
  text: string;
  isRecording: boolean;
  language: Language;
  revealSpeed: number;
  showWordOnPause: boolean;
  animationStyle: AnimationStyle;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

interface WordState {
  text: string;
  isSpoken: boolean;
  isCurrent: boolean;
  isRevealed: boolean;
  isParagraphStart: boolean;
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

const EnhancedWordTracker = ({
  text,
  isRecording,
  language,
  revealSpeed,
  showWordOnPause,
  animationStyle,
  onTranscriptUpdate,
  className,
}: EnhancedWordTrackerProps) => {
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(Date.now());
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout>();
  const currentWordIndexRef = useRef<number>(-1);

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
      }))
    );
  }, [text]);

  // Setup speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    console.info('Speech recognition initialized with language:', language);

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
            console.log('🎯 Marking word as spoken:', currentWord.text);
            
            // Mark current word as spoken
            updated[nextIndex] = {
              ...currentWord,
              isSpoken: true,
              isRevealed: true,
              isCurrent: false,
            };

            // Move to next word
            nextIndex = nextIndex + 1;
            
            // Set the new current word
            if (nextIndex < updated.length) {
              updated.forEach((w, i) => {
                updated[i] = { ...w, isCurrent: i === nextIndex };
              });
              setCurrentWordIndex(nextIndex);
              console.log('➡️ Moving to next word index:', nextIndex);
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
      console.info('🎙️ Speech recognition listening...');
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
        isRevealed: false 
      })));
      setCurrentWordIndex(0);
      setLastSpeechTime(Date.now());
      
      try {
        recognitionRef.current.start();
        console.log('✅ Speech recognition started successfully');
      } catch (error) {
        console.error('❌ Failed to start speech recognition:', error);
      }
    } else if (!isRecording && recognitionRef.current) {
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

  // Tap to reveal
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
    
    if (word.isSpoken) {
      return cn(
        base,
        "bg-[hsl(var(--success-green))] text-white shadow-sm",
        animationStyle === 'playful' && "animate-fill-in",
        animationStyle === 'energetic' && "animate-fill-in",
        animationStyle === 'minimal' && "animate-fade-in-up"
      );
    }

    if (word.isCurrent) {
      if (!word.isRevealed) {
        return cn(
          base,
          "bg-[hsl(var(--word-bg))] text-[hsl(var(--word-text))]",
          "border-2 border-dashed border-[hsl(var(--word-bg))]",
          "cursor-pointer hover:border-primary/30"
        );
      }
      return cn(
        base,
        "bg-[hsl(var(--word-bg))] text-[hsl(var(--word-text))]",
        "border-2 border-primary animate-pulse"
      );
    }

    return cn(
      base, 
      "bg-transparent text-[hsl(var(--word-text))] opacity-40"
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative max-h-[65vh] overflow-y-auto scroll-smooth",
        "bg-white dark:bg-gray-50 rounded-2xl shadow-lg",
        "p-8 md:p-12",
        className
      )}
      onClick={handleTapToReveal}
    >
      <div className="flex flex-wrap items-center justify-center gap-1 leading-loose">
        {wordStates.map((word, index) => (
          <span
            key={index}
            data-word-index={index}
            className={getWordClassName(word, index)}
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
      
      {isRecording && currentWordIndex >= 0 && !wordStates[currentWordIndex]?.isRevealed && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-500 animate-fade-in bg-white/90 px-4 py-2 rounded-full shadow-sm">
          💡 Tap anywhere to reveal
        </div>
      )}
    </div>
  );
};

export default EnhancedWordTracker;
