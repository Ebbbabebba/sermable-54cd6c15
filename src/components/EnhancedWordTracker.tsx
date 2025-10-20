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

// Nordic character normalization for fuzzy matching
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
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }

      setLastSpeechTime(Date.now());
      if (onTranscriptUpdate) {
        onTranscriptUpdate(transcript);
      }

      console.info('Speech recognition transcript:', transcript);

      // Process spoken words with Nordic character support
      const spokenWords = transcript.toLowerCase().split(/\s+/);
      const normalizedSpoken = spokenWords.map(normalizeNordic);

      setWordStates((prev) => {
        const updated = [...prev];
        let lastMatchedIndex = currentWordIndex;

        updated.forEach((word, index) => {
          const normalizedWord = normalizeNordic(word.text);
          
          // Check if word matches any spoken word
          if (normalizedSpoken.some(spoken => 
            spoken.includes(normalizedWord) || normalizedWord.includes(spoken)
          )) {
            updated[index] = {
              ...word,
              isSpoken: true,
              isRevealed: true,
              isCurrent: false,
            };
            lastMatchedIndex = Math.max(lastMatchedIndex, index);
          }
        });

        // Update current word to next unspoken word
        const nextIndex = lastMatchedIndex + 1;
        if (nextIndex < updated.length && !updated[nextIndex].isSpoken) {
          updated.forEach((w, i) => {
            updated[i] = { ...w, isCurrent: i === nextIndex };
          });
          setCurrentWordIndex(nextIndex);
        }

        return updated;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.onstart = () => {
      console.info('Speech recognition started');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, currentWordIndex, onTranscriptUpdate]);

  // Handle recording state
  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      setWordStates((prev) => prev.map((w) => ({ ...w, isSpoken: false, isCurrent: false, isRevealed: false })));
      setCurrentWordIndex(0);
      setLastSpeechTime(Date.now());
      recognitionRef.current.start();
    } else if (!isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
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
    const base = "inline-block px-2 py-1 mx-1 my-0.5 rounded-lg transition-all duration-300";
    
    if (word.isSpoken) {
      return cn(
        base,
        "text-[hsl(var(--neon-green))]",
        "bg-[hsl(var(--neon-green)_/_0.15)]",
        "shadow-[0_0_12px_hsl(var(--neon-green)_/_0.4)]",
        animationStyle === 'playful' && "animate-gentle-bounce",
        animationStyle === 'energetic' && "animate-confetti-pop"
      );
    }

    if (word.isCurrent) {
      if (!word.isRevealed) {
        return cn(
          base,
          "text-transparent",
          "bg-muted/50",
          "backdrop-blur-sm",
          "cursor-pointer",
          "hover:bg-muted/70"
        );
      }
      return cn(
        base,
        "text-[hsl(var(--neon-cyan))]",
        "bg-[hsl(var(--neon-cyan)_/_0.15)]",
        "shadow-[0_0_16px_hsl(var(--neon-cyan)_/_0.5)]",
        "animate-neon-pulse",
        "animate-soft-reveal"
      );
    }

    return cn(base, "text-muted-foreground/50 blur-[2px]");
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative max-h-[60vh] overflow-y-auto scroll-smooth",
        "text-4xl md:text-5xl lg:text-6xl leading-relaxed",
        "p-8 rounded-lg",
        className
      )}
      onClick={handleTapToReveal}
    >
      <div className="flex flex-wrap items-center justify-center">
        {wordStates.map((word, index) => (
          <span
            key={index}
            data-word-index={index}
            className={getWordClassName(word, index)}
            style={{
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >
            {word.text}
          </span>
        ))}
      </div>
      
      {isRecording && currentWordIndex >= 0 && !wordStates[currentWordIndex]?.isRevealed && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-muted-foreground animate-fade-in">
          💡 Tap anywhere to reveal the word
        </div>
      )}
    </div>
  );
};

export default EnhancedWordTracker;
