import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WordPerformance {
  word: string;
  index: number;
  status: "correct" | "hesitated" | "missed" | "skipped";
  timeToSpeak?: number;
  wasPrompted: boolean;
  wrongWordsSaid?: string[];
}

interface StrictPresentationViewProps {
  text: string;
  speechLanguage: string;
  isRecording: boolean;
  isProcessing: boolean;
  elapsedTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPerformanceData: (data: WordPerformance[]) => void;
}

// Normalize text for comparison
const normalizeWord = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/[öø]/g, "o")
    .replace(/æ/g, "ae")
    .replace(/[^\w]/g, "");
};

// Calculate word similarity
const getWordSimilarity = (word1: string, word2: string): number => {
  const w1 = normalizeWord(word1);
  const w2 = normalizeWord(word2);
  if (w1 === w2) return 1.0;
  if (w1.length <= 2 || w2.length <= 2) return w1 === w2 ? 1.0 : 0.0;
  
  const maxLen = Math.max(w1.length, w2.length);
  const minLen = Math.min(w1.length, w2.length);
  if (minLen / maxLen >= 0.7 && (w1.startsWith(w2) || w2.startsWith(w1))) return 0.85;
  
  let matches = 0;
  for (let i = 0; i < Math.min(w1.length, w2.length); i++) {
    if (w1[i] === w2[i]) matches++;
  }
  return matches / maxLen;
};

export const StrictPresentationView = ({
  text,
  speechLanguage,
  isRecording,
  isProcessing,
  elapsedTime,
  onStartRecording,
  onStopRecording,
  onPerformanceData,
}: StrictPresentationViewProps) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showHint, setShowHint] = useState<{ word: string; phase: "trying" | "showing" } | null>(null);
  const [wordPerformance, setWordPerformance] = useState<WordPerformance[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordStartTimeRef = useRef<number>(Date.now());
  const transcriptRef = useRef<string>("");
  const wrongAttempts = useRef<string[]>([]);
  const lastProgressTime = useRef<number>(Date.now());
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  // Initialize speech recognition
  useEffect(() => {
    if (!isRecording) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage || "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
        processTranscript(finalTranscript);
      }
      
      // Update audio level visual feedback
      if (interimTranscript || finalTranscript) {
        setAudioLevel(0.8);
        lastProgressTime.current = Date.now();
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart recognition");
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isRecording, speechLanguage]);

  // Audio level decay
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevel(prev => Math.max(0, prev - 0.1));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Silence detection for hint system
  useEffect(() => {
    if (!isRecording || currentWordIndex >= words.length) return;

    const checkSilence = () => {
      const silenceDuration = Date.now() - lastProgressTime.current;
      const currentWord = words[currentWordIndex];
      
      // Show "try" prompt after 1.5s of silence
      if (silenceDuration >= 1500 && !showHint) {
        setShowHint({ word: currentWord, phase: "trying" });
      }
      
      // Show full word after 3s (or 1s if user made wrong attempt)
      const showWordDelay = wrongAttempts.current.length > 0 ? 1000 : 3000;
      if (silenceDuration >= showWordDelay && showHint?.phase === "trying") {
        setShowHint({ word: currentWord, phase: "showing" });
        
        // Mark as prompted
        setWordPerformance(prev => {
          const existing = prev.find(p => p.index === currentWordIndex);
          if (existing) {
            return prev.map(p => p.index === currentWordIndex ? { ...p, wasPrompted: true } : p);
          }
          return prev;
        });
      }
    };

    const interval = setInterval(checkSilence, 200);
    return () => clearInterval(interval);
  }, [isRecording, currentWordIndex, showHint, words]);

  // Process transcript and match words
  const processTranscript = useCallback((newTranscript: string) => {
    const spokenWords = newTranscript.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    
    for (const spokenWord of spokenWords) {
      if (currentWordIndex >= words.length) break;
      
      const targetWord = words[currentWordIndex];
      const similarity = getWordSimilarity(spokenWord, targetWord);
      
      if (similarity >= 0.5) {
        // Match found!
        const timeToSpeak = Date.now() - wordStartTimeRef.current;
        const wasPrompted = showHint?.phase === "showing";
        const status: WordPerformance["status"] = 
          wasPrompted ? "hesitated" : 
          timeToSpeak > 2500 ? "hesitated" : 
          "correct";
        
        const performance: WordPerformance = {
          word: targetWord,
          index: currentWordIndex,
          status,
          timeToSpeak,
          wasPrompted,
          wrongWordsSaid: wrongAttempts.current.length > 0 ? [...wrongAttempts.current] : undefined,
        };
        
        setWordPerformance(prev => [...prev, performance]);
        
        // Move to next word
        setCurrentWordIndex(prev => prev + 1);
        setShowHint(null);
        wrongAttempts.current = [];
        wordStartTimeRef.current = Date.now();
        lastProgressTime.current = Date.now();
        
        console.log(`✅ Word "${targetWord}" matched (${status})`);
      } else {
        // No match - check if it matches a future word (skip detection)
        let foundAhead = false;
        for (let i = 1; i <= 3 && currentWordIndex + i < words.length; i++) {
          const aheadWord = words[currentWordIndex + i];
          if (getWordSimilarity(spokenWord, aheadWord) >= 0.5) {
            // User skipped words
            for (let j = 0; j < i; j++) {
              const skippedWord = words[currentWordIndex + j];
              const performance: WordPerformance = {
                word: skippedWord,
                index: currentWordIndex + j,
                status: "skipped",
                wasPrompted: false,
              };
              setWordPerformance(prev => [...prev, performance]);
              console.log(`⏭️ Word "${skippedWord}" skipped`);
            }
            
            // Now match the ahead word
            const performance: WordPerformance = {
              word: aheadWord,
              index: currentWordIndex + i,
              status: "correct",
              timeToSpeak: Date.now() - wordStartTimeRef.current,
              wasPrompted: false,
            };
            setWordPerformance(prev => [...prev, performance]);
            
            setCurrentWordIndex(prev => prev + i + 1);
            setShowHint(null);
            wrongAttempts.current = [];
            wordStartTimeRef.current = Date.now();
            lastProgressTime.current = Date.now();
            foundAhead = true;
            break;
          }
        }
        
        if (!foundAhead) {
          // Wrong word spoken - track it
          wrongAttempts.current.push(spokenWord);
          lastProgressTime.current = Date.now(); // User is trying
          console.log(`❌ Wrong word: "${spokenWord}" (expected "${targetWord}")`);
        }
      }
    }
  }, [currentWordIndex, words, showHint]);

  // Send performance data when recording stops
  useEffect(() => {
    if (!isRecording && wordPerformance.length > 0) {
      // Mark remaining words as missed
      const remainingPerformance: WordPerformance[] = [];
      for (let i = currentWordIndex; i < words.length; i++) {
        remainingPerformance.push({
          word: words[i],
          index: i,
          status: "missed",
          wasPrompted: false,
        });
      }
      const finalPerformance = [...wordPerformance, ...remainingPerformance];
      onPerformanceData(finalPerformance);
    }
  }, [isRecording]);

  // Reset state when recording starts
  useEffect(() => {
    if (isRecording) {
      setCurrentWordIndex(0);
      setShowHint(null);
      setWordPerformance([]);
      transcriptRef.current = "";
      wrongAttempts.current = [];
      wordStartTimeRef.current = Date.now();
      lastProgressTime.current = Date.now();
    }
  }, [isRecording]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Status Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border border-border shadow-lg">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span className="text-sm font-medium text-muted-foreground">Ready</span>
            </>
          )}
        </div>
        <div className="text-sm font-mono">
          {minutes.toString().padStart(2, "0")}:{seconds.toString().padStart(2, "0")}
        </div>
        {isRecording && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {currentWordIndex}/{words.length}
            </span>
          </div>
        )}
      </div>

      {/* Main Content - Clean Speak Icon */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        {/* Speak Icon with Audio Level Visualization */}
        <div className="relative">
          {/* Outer ring - audio visualization */}
          <div 
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-150",
              isRecording && "animate-pulse"
            )}
            style={{
              transform: `scale(${1 + audioLevel * 0.3})`,
              background: isRecording 
                ? `radial-gradient(circle, hsl(var(--primary) / ${0.1 + audioLevel * 0.2}) 0%, transparent 70%)`
                : "transparent",
            }}
          />
          
          {/* Main speak icon */}
          <div 
            className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
              isRecording 
                ? "bg-primary/10 border-4 border-primary shadow-lg shadow-primary/20" 
                : "bg-muted/50 border-2 border-border"
            )}
          >
            <Volume2 
              className={cn(
                "w-16 h-16 transition-all duration-300",
                isRecording ? "text-primary" : "text-muted-foreground"
              )}
              style={{
                transform: isRecording ? `scale(${1 + audioLevel * 0.2})` : "scale(1)",
              }}
            />
          </div>
        </div>

        {/* Instruction Text */}
        <p className={cn(
          "mt-8 text-lg transition-all duration-300",
          isRecording ? "text-foreground" : "text-muted-foreground"
        )}>
          {isRecording ? "Speak your presentation..." : "Press the button to start"}
        </p>

        {/* Progress indicator */}
        {isRecording && (
          <div className="mt-4 w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${(currentWordIndex / words.length) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Teleprompter Hint Strip */}
      {showHint && (
        <div 
          className={cn(
            "fixed bottom-32 left-0 right-0 z-40 flex items-center justify-center transition-all duration-300",
            "animate-fade-in"
          )}
        >
          <div 
            className={cn(
              "px-12 py-6 rounded-2xl shadow-2xl transition-all duration-300 min-w-[300px] text-center",
              showHint.phase === "trying" 
                ? "bg-primary/90 text-primary-foreground" 
                : "bg-yellow-500 text-yellow-950"
            )}
          >
            {showHint.phase === "trying" ? (
              <span className="text-3xl md:text-5xl font-medium">
                💭 Try to say it...
              </span>
            ) : (
              <span className="text-4xl md:text-6xl font-bold tracking-wide">
                {showHint.word}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? onStopRecording : onStartRecording}
          disabled={isProcessing}
          className="rounded-full h-16 w-16 p-0 shadow-lg"
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
            <p className="text-lg font-medium">Analyzing your presentation...</p>
          </div>
        </div>
      )}
    </div>
  );
};
