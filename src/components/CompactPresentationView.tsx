import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WearableHUD, type ViewMode } from "./WearableHUD";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { motion, AnimatePresence } from "framer-motion";

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
  hintDelay?: number;
  sentenceStartDelay?: number;
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

import { isHardToRecognizeWord } from "@/utils/wordRecognition";

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
  hintDelay = 1000,
  sentenceStartDelay = 4000,
}: CompactPresentationViewProps) => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [showHint, setShowHint] = useState<{ word: string; phase: "trying" | "showing" } | null>(null);
  const [wordPerformance, setWordPerformance] = useState<WordPerformance[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState<'idle' | 'speaking' | 'silence' | 'error' | 'success'>('idle');
  
  const haptics = useHapticFeedback({ enabled: true });
  const { t } = useTranslation();
  
  const recognitionRef = useRef<any>(null);
  const wordStartTimeRef = useRef<number>(Date.now());
  const transcriptRef = useRef<string>("");
  const wrongAttempts = useRef<string[]>([]);
  const lastProgressTime = useRef<number>(Date.now());
  const restartAttemptsRef = useRef<number>(0);
  const maxRestartAttempts = 10;
  const currentWordIndexRef = useRef(0);
  const processTranscriptRef = useRef<(t: string) => void>(() => {});
  const lastProcessedInterimRef = useRef<string>("");
  
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const progress = (currentWordIndex / words.length) * 100;

  // Split text into sentences for teleprompter display
  const sentences = useMemo(() => {
    const result: { words: string[]; startIndex: number }[] = [];
    let currentSentence: string[] = [];
    let sentenceStart = 0;

    words.forEach((word, i) => {
      currentSentence.push(word);
      // Check if word ends a sentence
      if (/[.!?]$/.test(word) || i === words.length - 1) {
        result.push({ words: [...currentSentence], startIndex: sentenceStart });
        currentSentence = [];
        sentenceStart = i + 1;
      }
    });

    // Handle case where last chunk didn't end with punctuation
    if (currentSentence.length > 0) {
      result.push({ words: currentSentence, startIndex: sentenceStart });
    }

    return result;
  }, [text]);

  // Find which sentence the current word belongs to
  const currentSentenceIndex = useMemo(() => {
    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      if (currentWordIndex >= s.startIndex && currentWordIndex < s.startIndex + s.words.length) {
        return i;
      }
    }
    return sentences.length - 1;
  }, [currentWordIndex, sentences]);

  // Track recently spoken words for staggered fade-out
  const [fadingWords, setFadingWords] = useState<Set<number>>(new Set());

  // When currentWordIndex advances, add the previous word to fading set
  const prevWordIndexRef = useRef(0);
  useEffect(() => {
    if (currentWordIndex > prevWordIndexRef.current && isRecording) {
      const newFading = new Set(fadingWords);
      for (let i = prevWordIndexRef.current; i < currentWordIndex; i++) {
        newFading.add(i);
        // Remove from fading after animation completes
        setTimeout(() => {
          setFadingWords(prev => {
            const next = new Set(prev);
            next.delete(i);
            return next;
          });
        }, 500);
      }
      setFadingWords(newFading);
    }
    prevWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex, isRecording]);

  // Determine hesitation state for current word glow
  const isHesitating = showHint?.phase === "trying";
  const isShowingHint = showHint?.phase === "showing";

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
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // Process interim results for real-time feel
      if (interimTranscript && interimTranscript !== lastProcessedInterimRef.current) {
        // Only process new words from interim that we haven't seen
        const prevWords = lastProcessedInterimRef.current.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
        const currentWords = interimTranscript.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
        
        // Find new words at the end of the interim transcript
        const newWords = currentWords.slice(prevWords.length);
        if (newWords.length > 0) {
          processTranscriptRef.current(newWords.join(" "));
        }
        lastProcessedInterimRef.current = interimTranscript;
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
        // Reset interim tracking since final result replaces interim
        lastProcessedInterimRef.current = "";
        // Don't re-process words already handled via interim
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
      
      // Detect if this is the first word of a sentence
      const isSentenceStart = currentWordIndex === 0 || /[.!?]$/.test(words[currentWordIndex - 1]);
      const effectiveDelay = isSentenceStart ? sentenceStartDelay : hintDelay;
      
      // Show "try" prompt at 60% of the delay
      const tryDelay = Math.round(effectiveDelay * 0.6);
      
      if (silenceDuration >= tryDelay && !showHint) {
        setShowHint({ word: currentWord, phase: "trying" });
        setStatus('silence');
        haptics.trigger('warning');
      }
      
      const showWordDelay = wrongAttempts.current.length > 0 ? Math.round(effectiveDelay * 0.5) : effectiveDelay;
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
    let localIndex = currentWordIndexRef.current;
    
    for (const spokenWord of spokenWords) {
      if (localIndex >= words.length) break;
      
      const targetWord = words[localIndex];
      const similarity = getWordSimilarity(spokenWord, targetWord);
      
      if (similarity >= 0.5) {
        const timeToSpeak = Date.now() - wordStartTimeRef.current;
        const wasPrompted = showHint?.phase === "showing";
        const wordStatus: WordPerformance["status"] = 
          wasPrompted ? "hesitated" : 
          timeToSpeak > 2500 ? "hesitated" : 
          "correct";
        
        const performance: WordPerformance = {
          word: targetWord,
          index: localIndex,
          status: wordStatus,
          timeToSpeak,
          wasPrompted,
          wrongWordsSaid: wrongAttempts.current.length > 0 ? [...wrongAttempts.current] : undefined,
        };
        
        setWordPerformance(prev => [...prev, performance]);
        localIndex++;
        setCurrentWordIndex(localIndex);
        currentWordIndexRef.current = localIndex;
        setShowHint(null);
        wrongAttempts.current = [];
        wordStartTimeRef.current = Date.now();
        lastProgressTime.current = Date.now();
        
        haptics.trigger('success');
        setStatus('success');
        setTimeout(() => setStatus('speaking'), 200);
        
        if (localIndex % 10 === 0) {
          haptics.trigger('progress');
        }
      } else {
        // Check for skipped words (lookahead)
        let foundAhead = false;
        for (let i = 1; i <= 3 && localIndex + i < words.length; i++) {
          const aheadWord = words[localIndex + i];
          if (getWordSimilarity(spokenWord, aheadWord) >= 0.5) {
            for (let j = 0; j < i; j++) {
              const skippedWord = words[localIndex + j];
              setWordPerformance(prev => [...prev, {
                word: skippedWord,
                index: localIndex + j,
                status: "skipped",
                wasPrompted: false,
              }]);
            }
            
            setWordPerformance(prev => [...prev, {
              word: aheadWord,
              index: localIndex + i,
              status: "correct",
              timeToSpeak: Date.now() - wordStartTimeRef.current,
              wasPrompted: false,
            }]);
            
            localIndex = localIndex + i + 1;
            setCurrentWordIndex(localIndex);
            currentWordIndexRef.current = localIndex;
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
  }, [words, showHint, haptics]);

  // Keep ref in sync
  useEffect(() => {
    processTranscriptRef.current = processTranscript;
  }, [processTranscript]);

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
      currentWordIndexRef.current = 0;
      setShowHint(null);
      setWordPerformance([]);
      transcriptRef.current = "";
      lastProcessedInterimRef.current = "";
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
              <p className="text-lg font-medium">{t('presentation.analyzingShort')}</p>
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
          {t('common.exit')}
        </Button>
      )}

      {/* Status Bar */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border border-border shadow-lg">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">{t('presentation.recording')}</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span className="text-sm font-medium text-muted-foreground">{t('presentation.ready')}</span>
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

      {/* Main Content - Sentence Teleprompter */}
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
        {!isRecording ? (
          <div className="text-center space-y-4">
            <p className="text-xl text-muted-foreground">{t('presentation.pressToStart')}</p>
            <p className="text-sm text-muted-foreground/60">
              {t('presentation.speechAppearSentence')}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-8">
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Sentence display area */}
            <div className="min-h-[300px] flex flex-col items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSentenceIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-3"
                >
                  {sentences[currentSentenceIndex]?.words.map((word, wordIdx) => {
                    const globalIndex = sentences[currentSentenceIndex].startIndex + wordIdx;
                    const isSpoken = globalIndex < currentWordIndex;
                    const isCurrent = globalIndex === currentWordIndex;
                    const isFading = fadingWords.has(globalIndex);

                    return (
                      <AnimatePresence key={globalIndex} mode="popLayout">
                        {/* Don't render fully spoken words that finished fading */}
                        {(!isSpoken || isFading) && (
                          <motion.span
                            layout
                            initial={false}
                            animate={
                              isFading
                                ? { opacity: 0, scale: 0.7, filter: "blur(4px)" }
                                : isCurrent
                                  ? { opacity: 1, scale: 1, filter: "blur(0px)" }
                                  : { opacity: 0.35, scale: 1, filter: "blur(0px)" }
                            }
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className={cn(
                              "inline-block transition-colors duration-200",
                              isCurrent
                                ? "text-3xl md:text-5xl font-bold text-foreground"
                                : "text-lg md:text-2xl font-normal text-muted-foreground",
                              isFading && "pointer-events-none"
                            )}
                          >
                            {/* Hesitation glow on current word */}
                            {isCurrent && (isHesitating || isShowingHint) && (
                              <motion.span
                                className="absolute inset-0 rounded-lg"
                                animate={{
                                  boxShadow: [
                                    "0 0 8px hsl(var(--primary) / 0.2)",
                                    "0 0 20px hsl(var(--primary) / 0.5)",
                                    "0 0 8px hsl(var(--primary) / 0.2)",
                                  ],
                                }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                              />
                            )}
                            <span className="relative">
                              {isCurrent && isShowingHint ? (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                  className="text-primary"
                                >
                                  {word}
                                </motion.span>
                              ) : (
                                word
                              )}
                            </span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                    );
                  })}
                </motion.div>
              </AnimatePresence>

              {/* "Try to say it" nudge */}
              <AnimatePresence>
                {isHesitating && !isShowingHint && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 text-sm text-muted-foreground"
                  >
                    {t('presentation.tryToSayIt')}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Sentence indicator */}
            <p className="text-center text-xs text-muted-foreground/50">
              {currentSentenceIndex + 1} / {sentences.length}
            </p>
          </div>
        )}

      </div>

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
            <p className="text-lg font-medium">{t('presentation.analyzing')}</p>
          </div>
        </div>
      )}
    </div>
  );
};
