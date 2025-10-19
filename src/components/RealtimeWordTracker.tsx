import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface RealtimeWordTrackerProps {
  text: string;
  isRecording: boolean;
  onTranscriptUpdate?: (transcript: string) => void;
  className?: string;
}

interface WordState {
  index: number;
  word: string;
  cleanWord: string;
  isSpoken: boolean;
  isRevealed: boolean;
  revealTimer?: NodeJS.Timeout;
}

const RealtimeWordTracker = ({ 
  text, 
  isRecording, 
  onTranscriptUpdate,
  className 
}: RealtimeWordTrackerProps) => {
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [currentWord, setCurrentWord] = useState<string>("");
  const [wordStates, setWordStates] = useState<WordState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const recognitionRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const words = text.split(/(\s+)/);
  const timersRef = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // Initialize word states
  useEffect(() => {
    const states: WordState[] = words
      .filter(w => !/^\s+$/.test(w))
      .map((word, index) => ({
        index,
        word,
        cleanWord: word.toLowerCase().replace(/[^\w]/g, ''),
        isSpoken: false,
        isRevealed: false,
      }));
    setWordStates(states);
  }, [text]);

  // Setup speech recognition with iPad/iOS support
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech recognition not supported on this device');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    // iPad/iOS specific settings
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      console.log('iOS/iPad device detected - optimizing speech recognition');
      recognition.continuous = false; // iOS works better with non-continuous mode
    }

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      console.log('Speech recognition transcript:', transcript);
      
      if (onTranscriptUpdate) {
        onTranscriptUpdate(transcript);
      }

      // Extract words and mark as spoken
      const transcriptWords = transcript.toLowerCase().split(/\s+/);
      const newSpokenWords = new Set(spokenWords);
      
      transcriptWords.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord) {
          newSpokenWords.add(cleanWord);
          
          // Update word states
          setWordStates(prev => prev.map(ws => 
            ws.cleanWord === cleanWord 
              ? { ...ws, isSpoken: true, isRevealed: true }
              : ws
          ));
        }
      });
      
      setSpokenWords(newSpokenWords);
      
      // Track current word being spoken
      if (transcriptWords.length > 0) {
        const lastWord = transcriptWords[transcriptWords.length - 1].replace(/[^\w]/g, '');
        setCurrentWord(lastWord);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      // Auto-restart on iPad/iOS
      if (/iPad|iPhone|iPod/.test(navigator.userAgent) && isRecording) {
        console.log('Attempting to restart recognition...');
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
      console.log('Recognition ended');
      // Auto-restart on iPad/iOS
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
    };
  }, [isRecording]);

  // Handle recording state
  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      setSpokenWords(new Set());
      setCurrentWord("");
      setCurrentIndex(0);
      
      // Clear all timers
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
      
      // Clear all timers on stop
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    }
  }, [isRecording]);

  // Smart word reveal timing
  useEffect(() => {
    if (!isRecording) return;

    wordStates.forEach((ws, idx) => {
      if (ws.isRevealed || ws.isSpoken) return;
      
      // Clear existing timer
      if (timersRef.current.has(idx)) {
        clearTimeout(timersRef.current.get(idx));
      }
      
      // Determine if first word in paragraph
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

    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [wordStates, isRecording]);

  // Auto-scroll to current word
  useEffect(() => {
    if (containerRef.current && currentWord) {
      const currentWordIndex = wordStates.findIndex(ws => ws.cleanWord === currentWord);
      if (currentWordIndex !== -1) {
        setCurrentIndex(currentWordIndex);
        const wordElement = containerRef.current.querySelector(`[data-index="${currentWordIndex}"]`);
        if (wordElement) {
          wordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [currentWord, wordStates]);

  // Tap to reveal word
  const handleWordTap = (index: number) => {
    setWordStates(prev => prev.map((w, i) => 
      i === index ? { ...w, isRevealed: true } : w
    ));
  };

  const getWordStyle = (ws: WordState) => {
    if (!ws.cleanWord) return "text-foreground/80";
    
    // Currently being spoken - neon cyan with glow
    if (currentWord === ws.cleanWord) {
      return "text-[hsl(var(--neon-cyan))] font-bold neon-glow scale-110";
    }
    
    // Already spoken - neon green
    if (ws.isSpoken) {
      return "text-[hsl(var(--neon-green))] font-semibold";
    }
    
    // Revealed but not spoken yet - dimmed
    if (ws.isRevealed) {
      return "text-foreground/70 font-medium";
    }
    
    // Hidden - very dim
    return "text-foreground/20 blur-[2px]";
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "max-h-[60vh] overflow-y-auto px-8 py-6 leading-loose",
        "scroll-smooth",
        className
      )}
    >
      <div className="text-4xl md:text-5xl lg:text-6xl font-medium space-y-6">
        {wordStates.map((ws) => (
          <span
            key={ws.index}
            data-index={ws.index}
            onClick={() => handleWordTap(ws.index)}
            className={cn(
              "inline-block mx-2 my-1 px-2 py-1 rounded-lg",
              "transition-all duration-300 cursor-pointer",
              "hover:scale-105 active:scale-95",
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
