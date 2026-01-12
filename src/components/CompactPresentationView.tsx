import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WearableHUD, type ViewMode } from "./WearableHUD";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

interface WordPerformance {
  word: string;
  index: number;
  status: "correct" | "hesitated" | "missed" | "skipped";
  timeToSpeak?: number;
  wasPrompted: boolean;
  wrongWordsSaid?: string[];
}

interface CompactPresentationViewProps {
  text: string;
  speechLanguage: string;
  isRecording: boolean;
  isProcessing: boolean;
  elapsedTime: number;
  viewMode: ViewMode;
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

// Normalize text for comparison (Unicode-aware)
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

export const CompactPresentationView = ({
  text,
  speechLanguage,
  isRecording,
  isProcessing,
  elapsedTime,
  viewMode,
  onStartRecording,
  onStopRecording,
  onPerformanceData,
  onExit,
}: CompactPresentationViewProps) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showHint, setShowHint] = useState<{ word: string; phase: "trying" | "showing" } | null>(null);
  const [wordPerformance, setWordPerformance] = useState<WordPerformance[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'speaking' | 'silence' | 'error' | 'success'>('idle');
  
  const haptics = useHapticFeedback({ enabled: true });
  
  const recognitionRef = useRef<any>(null);
  const wordStartTimeRef = useRef<number>(Date.now());
  const transcriptRef = useRef<string>("");
  const wrongAttempts = useRef<string[]>([]);
  const lastProgressTime = useRef<number>(Date.now());
  const restartAttemptsRef = useRef<number>(0);
  const maxRestartAttempts = 10;
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const progress = (currentWordIndex / words.length) * 100;
  
  // Get the next few keywords for display
  const getNextKeywords = (count: number = 3): string[] => {
    const keywords: string[] = [];
    for (let i = currentWordIndex; i < Math.min(currentWordIndex + count, words.length); i++) {
      const word = words[i];
      // Filter out small words, keep important ones
      if (word.length > 3) {
        keywords.push(word);
        if (keywords.length >= count) break;
      }
    }
    return keywords;
  };
  
  const nextKeyword = words[currentWordIndex] || '';

  // Initialize speech recognition
  useEffect(() => {
    if (!isRecording) {
      restartAttemptsRef.current = 0;
      setStatus('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("❌ Speech recognition not supported");
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
      setStatus('idle');
    };

    recognition.onspeechstart = () => {
      setAudioLevel(0.6);
      setStatus('speaking');
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
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setStatus('error');
        haptics.trigger('error');
      }
    };

    recognition.onend = () => {
      if (isRecording && restartAttemptsRef.current < maxRestartAttempts) {
        restartAttemptsRef.current++;
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {}
          }
        }, 300);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {}

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

  // Silence detection
  useEffect(() => {
    if (!isRecording || currentWordIndex >= words.length) return;

    const checkSilence = () => {
      const silenceDuration = Date.now() - lastProgressTime.current;
      const currentWord = words[currentWordIndex];
      
      if (silenceDuration >= 1500 && !showHint) {
        setShowHint({ word: currentWord, phase: "trying" });
        setStatus('silence');
        haptics.trigger('warning');
      }
      
      const showWordDelay = wrongAttempts.current.length > 0 ? 1000 : 3000;
      if (silenceDuration >= showWordDelay && showHint?.phase === "trying") {
        setShowHint({ word: currentWord, phase: "showing" });
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
        setCurrentWordIndex(prev => prev + 1);
        setShowHint(null);
        wrongAttempts.current = [];
        wordStartTimeRef.current = Date.now();
        lastProgressTime.current = Date.now();
        
        // Haptic feedback for success
        haptics.trigger('success');
        setStatus('success');
        setTimeout(() => setStatus('speaking'), 200);
        
        // Check for segment progress (every 10 words)
        if ((currentWordIndex + 1) % 10 === 0) {
          haptics.trigger('progress');
        }
      } else {
        // Check for skipped words
        let foundAhead = false;
        for (let i = 1; i <= 3 && currentWordIndex + i < words.length; i++) {
          const aheadWord = words[currentWordIndex + i];
          if (getWordSimilarity(spokenWord, aheadWord) >= 0.5) {
            for (let j = 0; j < i; j++) {
              const skippedWord = words[currentWordIndex + j];
              setWordPerformance(prev => [...prev, {
                word: skippedWord,
                index: currentWordIndex + j,
                status: "skipped",
                wasPrompted: false,
              }]);
            }
            
            setWordPerformance(prev => [...prev, {
              word: aheadWord,
              index: currentWordIndex + i,
              status: "correct",
              timeToSpeak: Date.now() - wordStartTimeRef.current,
              wasPrompted: false,
            }]);
            
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
          wrongAttempts.current.push(spokenWord);
          lastProgressTime.current = Date.now();
          setStatus('error');
          haptics.trigger('error');
        }
      }
    }
  }, [currentWordIndex, words, showHint, haptics]);

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
      
      // Completion haptic
      haptics.trigger('complete');
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
      setStatus('idle');
    }
  }, [isRecording]);

  const handleToggleRecording = () => {
    haptics.trigger('tap');
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  // Use WearableHUD for compact and wearable modes
  if (viewMode === 'compact' || viewMode === 'wearable') {
    return (
      <>
        <WearableHUD
          viewMode={viewMode}
          progress={progress}
          currentWord={currentWordIndex}
          totalWords={words.length}
          nextKeyword={showHint?.phase === 'showing' ? showHint.word : nextKeyword}
          isRecording={isRecording}
          isListening={audioLevel > 0.3}
          status={status}
          onToggleRecording={handleToggleRecording}
          elapsedTime={elapsedTime}
        />
        
        {/* Processing Overlay */}
        {isProcessing && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
              <p className="text-lg font-medium">Analyzing...</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Full mode - original detailed view
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

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

      {/* Main Content */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="relative">
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

        <p className={cn(
          "mt-8 text-lg transition-all duration-300",
          isRecording ? "text-foreground" : "text-muted-foreground"
        )}>
          {isRecording ? "Speak your presentation..." : "Press the button to start"}
        </p>

        {isRecording && (
          <div className="mt-4 w-48 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Hint Strip */}
      {showHint && (
        <div className="fixed bottom-32 left-0 right-0 z-40 flex items-center justify-center animate-fade-in">
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
          onClick={handleToggleRecording}
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
