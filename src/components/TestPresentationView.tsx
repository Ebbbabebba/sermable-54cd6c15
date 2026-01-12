import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Circle, Square, Volume2, X, Timer, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { CircularProgress } from "./CircularProgress";
import { motion, AnimatePresence } from "framer-motion";

interface WordPerformance {
  word: string;
  index: number;
  status: "correct" | "hesitated" | "missed" | "skipped";
  timeToSpeak?: number;
  wasPrompted: boolean;
  wrongWordsSaid?: string[];
}

interface TestPresentationViewProps {
  text: string;
  speechLanguage: string;
  isRecording: boolean;
  isProcessing: boolean;
  elapsedTime: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPerformanceData: (data: WordPerformance[]) => void;
  onExit?: () => void;
}

// Map short language codes to full locale codes for Web Speech API
const getRecognitionLanguage = (lang: string): string => {
  if (!lang) return "en-US";
  
  if (lang.includes("-") || lang.includes("_")) {
    return lang.replace("_", "-");
  }
  
  const langMap: Record<string, string> = {
    en: "en-US",
    sv: "sv-SE",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    pt: "pt-PT",
    nl: "nl-NL",
    da: "da-DK",
    no: "nb-NO",
    fi: "fi-FI",
    pl: "pl-PL",
    ru: "ru-RU",
    ja: "ja-JP",
    ko: "ko-KR",
    zh: "zh-CN",
  };
  
  return langMap[lang.toLowerCase()] || `${lang}-${lang.toUpperCase()}`;
};

// Normalize text for comparison
const normalizeWord = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
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

export const TestPresentationView = ({
  text,
  speechLanguage,
  isRecording,
  isProcessing,
  elapsedTime,
  onStartRecording,
  onStopRecording,
  onPerformanceData,
  onExit,
}: TestPresentationViewProps) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wordPerformance, setWordPerformance] = useState<WordPerformance[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'speaking' | 'silence'>('idle');
  
  const recognitionRef = useRef<any>(null);
  const wordStartTimeRef = useRef<number>(Date.now());
  const transcriptRef = useRef<string>("");
  const lastProgressTime = useRef<number>(Date.now());
  const restartAttemptsRef = useRef<number>(0);
  const maxRestartAttempts = 10;
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const progress = words.length > 0 ? (currentWordIndex / words.length) * 100 : 0;
  
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  // Initialize speech recognition
  useEffect(() => {
    if (!isRecording) {
      restartAttemptsRef.current = 0;
      setStatus('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      return;
    }

    const recognitionLang = getRecognitionLanguage(speechLanguage);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = recognitionLang;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      restartAttemptsRef.current = 0;
      setStatus('silence');
    };

    recognition.onspeechstart = () => {
      setStatus('speaking');
      setAudioLevel(0.6);
    };

    recognition.onspeechend = () => {
      setStatus('silence');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        }
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
        processTranscript(finalTranscript);
      }
      
      setAudioLevel(0.8);
      lastProgressTime.current = Date.now();
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      if (isRecording && restartAttemptsRef.current < maxRestartAttempts) {
        restartAttemptsRef.current++;
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.error("Failed to restart recognition:", e);
            }
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Failed to start recognition:", e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
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

  // Process transcript and match words - NO HINTS, just tracking
  const processTranscript = useCallback((newTranscript: string) => {
    const spokenWords = newTranscript.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    
    for (const spokenWord of spokenWords) {
      if (currentWordIndex >= words.length) break;
      
      const targetWord = words[currentWordIndex];
      const similarity = getWordSimilarity(spokenWord, targetWord);
      
      if (similarity >= 0.5) {
        const timeToSpeak = Date.now() - wordStartTimeRef.current;
        const status: WordPerformance["status"] = 
          timeToSpeak > 2500 ? "hesitated" : "correct";
        
        const performance: WordPerformance = {
          word: targetWord,
          index: currentWordIndex,
          status,
          timeToSpeak,
          wasPrompted: false, // Never prompted in test mode
        };
        
        setWordPerformance(prev => [...prev, performance]);
        setCurrentWordIndex(prev => prev + 1);
        wordStartTimeRef.current = Date.now();
        lastProgressTime.current = Date.now();
      } else {
        // Check for skip
        for (let i = 1; i <= 3 && currentWordIndex + i < words.length; i++) {
          const aheadWord = words[currentWordIndex + i];
          if (getWordSimilarity(spokenWord, aheadWord) >= 0.5) {
            for (let j = 0; j < i; j++) {
              const skippedWord = words[currentWordIndex + j];
              const performance: WordPerformance = {
                word: skippedWord,
                index: currentWordIndex + j,
                status: "skipped",
                wasPrompted: false,
              };
              setWordPerformance(prev => [...prev, performance]);
            }
            
            const performance: WordPerformance = {
              word: aheadWord,
              index: currentWordIndex + i,
              status: "correct",
              timeToSpeak: Date.now() - wordStartTimeRef.current,
              wasPrompted: false,
            };
            setWordPerformance(prev => [...prev, performance]);
            
            setCurrentWordIndex(prev => prev + i + 1);
            wordStartTimeRef.current = Date.now();
            lastProgressTime.current = Date.now();
            break;
          }
        }
      }
    }
  }, [currentWordIndex, words]);

  // Send performance data when recording stops
  useEffect(() => {
    if (!isRecording && wordPerformance.length > 0) {
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
      setWordPerformance([]);
      transcriptRef.current = "";
      wordStartTimeRef.current = Date.now();
      lastProgressTime.current = Date.now();
    }
  }, [isRecording]);

  // Processing overlay
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium">Analyzing your performance...</p>
          <p className="text-sm text-muted-foreground">This may take a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Exit Button */}
      {onExit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="fixed top-4 left-4 z-50 gap-2"
        >
          <X className="h-4 w-4" />
          Exit
        </Button>
      )}

      {/* Status Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border border-border shadow-lg">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">TEST MODE</span>
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
      </div>

      {/* Main Content - Clean Test Interface */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        {/* Central Progress Circle */}
        <div className="relative mb-8">
          <CircularProgress
            value={progress}
            size={200}
            strokeWidth={12}
            showValue
            valueFormat="percent"
            progressColor={
              status === 'speaking' ? 'hsl(var(--primary))' :
              status === 'silence' ? 'hsl(45 93% 47%)' :
              'hsl(var(--muted-foreground))'
            }
          />
          
          {/* Pulse animation when speaking */}
          {isRecording && status === 'speaking' && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </div>

        {/* Word Count - Hidden progress */}
        <AnimatePresence mode="wait">
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-6 mb-8"
            >
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {currentWordIndex} / {words.length} words
                </span>
              </div>
              
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full">
                <Timer className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {Math.round((currentWordIndex / Math.max(1, elapsedTime / 60)))} WPM
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audio Level Visualization */}
        <div className="relative mb-8">
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
          
          <div 
            className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300",
              isRecording 
                ? status === 'speaking' 
                  ? "bg-primary/20 border-4 border-primary" 
                  : "bg-yellow-500/20 border-4 border-yellow-500"
                : "bg-muted/50 border-2 border-border"
            )}
          >
            <Volume2 
              className={cn(
                "w-10 h-10 transition-all duration-300",
                isRecording 
                  ? status === 'speaking' ? "text-primary" : "text-yellow-500"
                  : "text-muted-foreground"
              )}
              style={{
                transform: isRecording ? `scale(${1 + audioLevel * 0.2})` : "scale(1)",
              }}
            />
          </div>
        </div>

        {/* Instruction Text */}
        <p className={cn(
          "text-lg transition-all duration-300 text-center max-w-md",
          isRecording ? "text-foreground" : "text-muted-foreground"
        )}>
          {isRecording 
            ? "Speak your presentation from memory — no hints will be shown" 
            : "This is TEST MODE — recite your speech without any prompts"}
        </p>

        {/* Info Banner when not recording */}
        {!isRecording && (
          <div className="mt-6 px-6 py-4 bg-primary/5 border border-primary/20 rounded-xl max-w-md text-center">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">True test of memorization:</strong> You'll receive no hints or prompts. 
              Your performance will be analyzed after you finish.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Control */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <Button
          size="lg"
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={cn(
            "h-16 px-8 rounded-full gap-3 shadow-lg transition-all",
            isRecording 
              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" 
              : "bg-primary hover:bg-primary/90"
          )}
        >
          {isRecording ? (
            <>
              <Square className="h-5 w-5" />
              <span className="font-semibold">Stop</span>
            </>
          ) : (
            <>
              <Circle className="h-5 w-5 fill-current" />
              <span className="font-semibold">Begin Test</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
