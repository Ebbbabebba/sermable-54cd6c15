import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";

interface RealtimeWordTrackerProps {
  text: string;
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
  language?: 'en-US' | 'sv-SE' | 'no-NO' | 'da-DK' | 'fi-FI';
}

interface WordState {
  index: number;
  word: string;
  cleanWord: string;
  normalizedWord: string;
  isSpoken: boolean;
  isRevealed: boolean;
  revealTimer?: NodeJS.Timeout;
}

const RealtimeWordTracker = ({ 
  text, 
  isRecording, 
  onTranscriptUpdate,
  className,
  language = 'sv-SE'
}: RealtimeWordTrackerProps) => {
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [currentWord, setCurrentWord] = useState<string>("");
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const updateQueueRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>();

  // Memoize word parsing to avoid recalculation
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  // Normalize text once for faster matching
  const normalizeWord = useCallback((word: string): string => {
    return word
      .toLowerCase()
      .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž]/gi, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }, []);

  // Initialize word states with pre-normalized words
  useEffect(() => {
    const states: WordState[] = words
      .filter(w => !/^\s+$/.test(w))
      .map((word, index) => {
        const cleanWord = word.toLowerCase().replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž]/gi, '');
        return {
          index,
          word,
          cleanWord,
          normalizedWord: normalizeWord(word),
          isSpoken: false,
          isRevealed: false,
        };
      });
    setWordStates(states);
  }, [text, words, normalizeWord]);

  // Batch word updates using requestAnimationFrame
  const batchUpdateWords = useCallback(() => {
    if (updateQueueRef.current.size === 0) return;

    const wordsToUpdate = Array.from(updateQueueRef.current);
    updateQueueRef.current.clear();

    setWordStates(prev => prev.map(ws => {
      if (wordsToUpdate.includes(ws.cleanWord) || wordsToUpdate.includes(ws.normalizedWord)) {
        return { ...ws, isSpoken: true, isRevealed: true };
      }
      return ws;
    }));
  }, []);

  // Debounced speech recognition handler
  const handleSpeechResult = useCallback((transcript: string, alternatives: string[]) => {
    if (onTranscriptUpdate) {
      onTranscriptUpdate(transcript);
    }

    const allTranscripts = [transcript, ...alternatives];
    const newSpokenWords = new Set(spokenWords);
    
    allTranscripts.forEach(transcriptText => {
      const transcriptWords = transcriptText.toLowerCase().split(/\s+/);
      
      transcriptWords.forEach(word => {
        const cleanWord = word.replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž]/gi, '').toLowerCase();
        if (cleanWord) {
          newSpokenWords.add(cleanWord);
          updateQueueRef.current.add(cleanWord);
          updateQueueRef.current.add(normalizeWord(cleanWord));
        }
      });
    });
    
    setSpokenWords(newSpokenWords);
    
    // Track current word
    const transcriptWords = transcript.toLowerCase().split(/\s+/);
    if (transcriptWords.length > 0) {
      const lastWord = transcriptWords[transcriptWords.length - 1]
        .replace(/[^\wåäöæøéèêëàáâãäüïîôûùúñçšž]/gi, '')
        .toLowerCase();
      setCurrentWord(lastWord);
    }

    // Batch update on next frame
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(batchUpdateWords);
  }, [spokenWords, onTranscriptUpdate, normalizeWord, batchUpdateWords]);

  // Setup speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported on this device');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;
    
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.log('iOS/iPad device detected - optimizing speech recognition');
      recognition.continuous = false;
    }
    
    console.log(`Speech recognition initialized with language: ${language}`);

    recognition.onresult = (event: any) => {
      let transcript = '';
      let allAlternatives: string[] = [];
      
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        for (let j = 0; j < Math.min(event.results[i].length, 3); j++) {
          allAlternatives.push(event.results[i][j].transcript);
        }
      }
      
      console.log('Speech recognition transcript:', transcript);
      handleSpeechResult(transcript, allAlternatives);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && isRecording) {
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('Failed to restart:', e);
            }
          }
        }, 100);
      }
    };

    recognition.onend = () => {
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && isRecording) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart on end:', e);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Error stopping recognition:', e);
        }
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isRecording, language, handleSpeechResult]);

  // Handle recording state
  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      setSpokenWords(new Set());
      setCurrentWord("");
      setCurrentIndex(0);
      updateQueueRef.current.clear();
      
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
      
      try {
        recognitionRef.current.start();
        console.log('Speech recognition started');
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    } else if (!isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    }
  }, [isRecording]);

  // Smart word reveal timing - optimized
  useEffect(() => {
    if (!isRecording) return;

    const updateTimers = () => {
      wordStates.forEach((ws, idx) => {
        if (ws.isRevealed || ws.isSpoken) return;
        
        if (timersRef.current.has(idx)) {
          clearTimeout(timersRef.current.get(idx));
        }
        
        const isFirstInParagraph = idx === 0 || 
          (idx > 0 && words[idx - 1]?.includes('\n'));
        
        const delay = isFirstInParagraph ? 10000 : 3000;
        
        const timer = setTimeout(() => {
          setWordStates(prev => prev.map((w, i) => 
            i === idx ? { ...w, isRevealed: true } : w
          ));
        }, delay);
        
        timersRef.current.set(idx, timer);
      });
    };

    updateTimers();

    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [wordStates, isRecording, words]);

  // Auto-scroll - throttled
  useEffect(() => {
    if (!containerRef.current || !currentWord) return;

    const currentWordIndex = wordStates.findIndex(ws => ws.cleanWord === currentWord);
    if (currentWordIndex !== -1 && currentWordIndex !== currentIndex) {
      setCurrentIndex(currentWordIndex);
      
      requestAnimationFrame(() => {
        const wordElement = containerRef.current?.querySelector(`[data-index="${currentWordIndex}"]`);
        if (wordElement) {
          wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [currentWord, wordStates, currentIndex]);

  // Tap to reveal word
  const handleWordTap = useCallback((index: number) => {
    setWordStates(prev => prev.map((w, i) => 
      i === index ? { ...w, isRevealed: true } : w
    ));
  }, []);

  // Memoized word style calculation
  const getWordStyle = useCallback((ws: WordState) => {
    if (!ws.cleanWord) return "text-foreground/80";
    
    if (currentWord === ws.cleanWord || currentWord === ws.normalizedWord) {
      return "text-[hsl(var(--neon-cyan))] font-bold neon-glow scale-110";
    }
    
    if (ws.isSpoken) {
      return "text-[hsl(var(--neon-green))] font-semibold";
    }
    
    if (ws.isRevealed) {
      return "text-foreground/70 font-medium";
    }
    
    return "text-foreground/20 blur-[2px]";
  }, [currentWord]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "max-h-[70vh] overflow-y-auto px-6 py-8 leading-loose",
        "scroll-smooth",
        "bg-gradient-to-b from-background to-muted/20",
        "rounded-xl shadow-lg",
        className
      )}
    >
      <div className="text-5xl md:text-6xl lg:text-7xl font-medium space-y-8 text-center">
        {wordStates.map((ws) => (
          <span
            key={ws.index}
            data-index={ws.index}
            onClick={() => handleWordTap(ws.index)}
            className={cn(
              "inline-block mx-3 my-2 px-3 py-2 rounded-xl",
              "transition-all duration-300 cursor-pointer",
              "hover:scale-110 active:scale-95",
              "select-none touch-manipulation",
              getWordStyle(ws)
            )}
          >
            {ws.word}
          </span>
        ))}
      </div>
    </div>
  );
};

export default RealtimeWordTracker;
