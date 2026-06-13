import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WearableHUD, type ViewMode } from "./WearableHUD";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { motion, AnimatePresence } from "framer-motion";
import { stripStageDirections, tokenizeScript } from "@/utils/stageDirections";
import StageDirectionCue, { getActiveDirections } from "@/components/StageDirectionCue";
import PropCueOverlay from "@/components/PropCueOverlay";
import { extractPropCues, getActivePropCue } from "@/utils/propCues";

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

// --- Matching tuning ---
// Tightened from 0.5 to stop unrelated words from leapfrogging the cursor.
const SIMILARITY_THRESHOLD = 0.72;
// Lookahead must clear a higher bar so a stray match doesn't skip a whole phrase.
const LOOKAHEAD_THRESHOLD = 0.78;
// Only allow skipping at most 2 words at a time in normal flow.
const LOOKAHEAD_WORDS = 2;
// When the speaker is clearly stuck (we have multiple unmatched attempts OR they
// have been on the same word for a while), widen the lookahead window so a word
// further ahead can force-advance the cursor past the stuck word.
const STUCK_LOOKAHEAD_WORDS = 6;
const STUCK_ATTEMPTS_THRESHOLD = 2;
const STUCK_TIME_MS = 2500;
// Minimum time between successful matches — prevents one burst from chain-advancing.
const MIN_WORD_DWELL_MS = 220;

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
  const lastMatchAtRef = useRef<number>(0);
  
  // Strip stage directions for the speech-recognition / matching pipeline,
  // but keep them as a separate token list so we can render them inline as
  // visual cues (italic) without consuming a word index.
  const { words, directionsByAfterIndex, propCues } = useMemo(() => {
    const { tokens, words: w } = tokenizeScript(text);
    const map = new Map<number, string[]>();
    for (const tok of tokens) {
      if (tok.type === "direction") {
        const list = map.get(tok.afterWordIndex) ?? [];
        list.push(tok.text);
        map.set(tok.afterWordIndex, list);
      }
    }
    const { cues } = extractPropCues(text);
    return { words: w, directionsByAfterIndex: map, propCues: cues };
  }, [text]);
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
  }, [words]);

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

  // Debounce sentence transitions so the next sentence doesn't pop in instantly
  // when the user crosses a boundary — gives ~700ms of breathing room.
  const [displayedSentenceIndex, setDisplayedSentenceIndex] = useState(0);
  useEffect(() => {
    if (currentSentenceIndex === displayedSentenceIndex) return;
    // Advance forward with a small delay; jump backwards immediately (manual nav)
    if (currentSentenceIndex < displayedSentenceIndex) {
      setDisplayedSentenceIndex(currentSentenceIndex);
      return;
    }
    const timer = setTimeout(() => {
      setDisplayedSentenceIndex(currentSentenceIndex);
    }, 700);
    return () => clearTimeout(timer);
  }, [currentSentenceIndex, displayedSentenceIndex]);

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

      // Only process the NEW tail of interim transcripts. Avoid reprocessing
      // earlier words on every revision — that caused the cursor to race ahead
      // on half-formed speech. Final transcripts below still go through the
      // matcher to catch real corrections.
      if (interimTranscript && interimTranscript !== lastProcessedInterimRef.current) {
        const prevWords = lastProcessedInterimRef.current.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
        const currentWords = interimTranscript.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);

        if (currentWords.length > prevWords.length) {
          const toProcess = currentWords.slice(prevWords.length);
          if (toProcess.length > 0) {
            processTranscriptRef.current(toProcess.join(" "));
          }
        }
        lastProcessedInterimRef.current = interimTranscript;
      }

      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
        // Final transcripts can contain corrections — process them too.
        processTranscriptRef.current(finalTranscript);
        lastProcessedInterimRef.current = "";
      }
      
      setAudioLevel(0.8);
      lastProgressTime.current = Date.now();
    };

    recognition.onerror = (event: any) => {
      // Whole Speech Mode is non-punitive — never surface an 'error' state to
      // the UI. Recognition glitches are silent; the auto-restart below keeps
      // us listening.
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

  // Silence detection + safety auto-advance.
  // Whole Speech Mode must NEVER get stuck on a word. After the hint has been
  // shown for a while with no recognition match, we silently bump the cursor
  // forward so the teleprompter keeps following the speaker.
  useEffect(() => {
    if (!isRecording || currentWordIndex >= words.length) return;

    const checkSilence = () => {
      const silenceDuration = Date.now() - lastProgressTime.current;
      const wordDuration = Date.now() - wordStartTimeRef.current;
      const currentWord = words[currentWordIndex];

      // Detect if this is the first word of a sentence
      const isSentenceStart = currentWordIndex === 0 || /[.!?]$/.test(words[currentWordIndex - 1]);
      const effectiveDelay = isSentenceStart ? sentenceStartDelay : hintDelay;

      // Show "try" prompt at 60% of the delay
      const tryDelay = Math.round(effectiveDelay * 0.6);

      if (silenceDuration >= tryDelay && !showHint) {
        setShowHint({ word: currentWord, phase: "trying" });
        // Never surface an error state — just a soft "silence" cue.
        setStatus('silence');
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

      // Safety auto-advance: if we've been stuck on this word for too long
      // (hint shown + extra grace), move the teleprompter forward by one word
      // so the script keeps following the speaker. Mark as hesitated, never
      // as skipped/missed — Whole Speech Mode is non-punitive.
      const AUTO_ADVANCE_AFTER = effectiveDelay + 2500;
      if (wordDuration >= AUTO_ADVANCE_AFTER) {
        const wasPrompted = showHint?.phase === "showing";
        setWordPerformance(prev => {
          if (prev.some(p => p.index === currentWordIndex)) return prev;
          return [...prev, {
            word: currentWord,
            index: currentWordIndex,
            status: "hesitated",
            timeToSpeak: wordDuration,
            wasPrompted,
          }];
        });
        const next = currentWordIndex + 1;
        currentWordIndexRef.current = next;
        setCurrentWordIndex(next);
        setShowHint(null);
        wrongAttempts.current = [];
        wordStartTimeRef.current = Date.now();
        lastProgressTime.current = Date.now();
        lastMatchAtRef.current = Date.now();
        setStatus('speaking');
      }
    };

    const interval = setInterval(checkSilence, 200);
    return () => clearInterval(interval);
  }, [isRecording, currentWordIndex, showHint, words, hintDelay, sentenceStartDelay]);


  // Process transcript and match words
  const processTranscript = useCallback((newTranscript: string) => {
    const spokenWords = newTranscript.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
    let localIndex = currentWordIndexRef.current;
    
    for (const spokenWord of spokenWords) {
      if (localIndex >= words.length) break;

      // Per-word dwell — don't allow a single burst of speech to chain-advance
      // multiple words instantly. Wait MIN_WORD_DWELL_MS between matches.
      if (Date.now() - lastMatchAtRef.current < MIN_WORD_DWELL_MS) {
        break;
      }

      const targetWord = words[localIndex];
      const hardWord = isHardToRecognizeWord(targetWord);
      const similarity = hardWord ? 1.0 : getWordSimilarity(spokenWord, targetWord);

      if (similarity >= SIMILARITY_THRESHOLD) {
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
        lastMatchAtRef.current = Date.now();

        // No per-word or per-sentence buzz — only the final completion buzz fires
        // (see haptics.trigger('complete') when the whole beat finishes).
        setStatus('success');
        setTimeout(() => setStatus('speaking'), 200);
      } else {
        // Whole Speech Mode is non-punitive: always use the wide lookahead
        // window so the teleprompter can leapfrog forward to wherever the
        // speaker actually is. Skipped words are marked as "correct" (not
        // "skipped") to avoid any red/error treatment downstream.
        const maxLookahead = STUCK_LOOKAHEAD_WORDS;

        let foundAhead = false;
        for (let i = 1; i <= maxLookahead && localIndex + i < words.length; i++) {
          const aheadWord = words[localIndex + i];
          const aheadHard = isHardToRecognizeWord(aheadWord);
          const aheadSim = aheadHard ? 1.0 : getWordSimilarity(spokenWord, aheadWord);
          if (aheadSim >= LOOKAHEAD_THRESHOLD) {
            for (let j = 0; j < i; j++) {
              const skippedWord = words[localIndex + j];
              setWordPerformance(prev => [...prev, {
                word: skippedWord,
                index: localIndex + j,
                status: "correct",
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
            lastMatchAtRef.current = Date.now();
            foundAhead = true;
            break;
          }
        }

        if (!foundAhead) {
          // Track the wrong attempt for retry logic, but never surface an
          // error state — the UI stays calm and keeps listening.
          wrongAttempts.current.push(spokenWord);
          lastProgressTime.current = Date.now();
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

  // Auto-stop and trigger analysis when the user reaches the end of the script.
  // Small delay so the final word's success animation/haptic can play first.
  const autoStoppedRef = useRef(false);
  useEffect(() => {
    if (!isRecording) {
      autoStoppedRef.current = false;
      return;
    }
    if (autoStoppedRef.current) return;
    if (words.length === 0) return;
    if (currentWordIndex >= words.length) {
      autoStoppedRef.current = true;
      const timer = setTimeout(() => {
        onStopRecording();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentWordIndex, isRecording, words.length, onStopRecording]);


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
      lastMatchAtRef.current = 0;
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
          className="fixed left-4 z-50 gap-2" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
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

            {/* Sentence display area — layout is LOCKED. All words render at the
                same size and position so the text doesn't reflow as the user
                speaks. Spoken words are dimmed in place; the current word is
                emphasized with weight + color only, never size. */}
            <div className="min-h-[300px] flex flex-col items-center justify-center">
              <StageDirectionCue
                directions={getActiveDirections(directionsByAfterIndex, currentWordIndex)}
                className="mb-2"
              />
              <PropCueOverlay
                cue={getActivePropCue(propCues, currentWordIndex)}
                className="mb-2"
              />
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={displayedSentenceIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-3 text-2xl md:text-4xl leading-relaxed font-semibold"
                >
                  {(() => {
                    const sentence = sentences[displayedSentenceIndex];
                    if (!sentence) return null;
                    const startIndex = sentence.startIndex;
                    const nodes: JSX.Element[] = [];

                    sentence.words.forEach((word, wordIdx) => {
                      const globalIndex = startIndex + wordIdx;
                      const isSpoken = globalIndex < currentWordIndex;
                      const isCurrent = globalIndex === currentWordIndex;

                      nodes.push(
                        <span
                          key={`w-${globalIndex}`}
                          className={cn(
                            "inline-block transition-colors duration-700 ease-out relative",
                            isCurrent
                              ? "text-foreground"
                              : isSpoken
                                ? "text-muted-foreground/25"
                                : "text-muted-foreground/70",
                          )}
                        >
                          {isCurrent && (isHesitating || isShowingHint) && (
                            <motion.span
                              className="absolute inset-0 rounded-lg pointer-events-none"
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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.2 }}
                                className="text-primary"
                              >
                                {word}
                              </motion.span>
                            ) : (
                              word
                            )}
                          </span>
                        </span>,
                      );
                    });

                    return nodes;
                  })()}
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
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            const targetSentence = Math.max(0, currentSentenceIndex - 1);
            const target = sentences[targetSentence]?.startIndex ?? 0;
            prevWordIndexRef.current = target;
            currentWordIndexRef.current = target;
            setCurrentWordIndex(target);
            setDisplayedSentenceIndex(targetSentence);
            setShowHint(null);
          }}
          disabled={currentSentenceIndex === 0}
          className="rounded-full h-12 w-12 p-0 shadow-md"
          aria-label={t('common.previous', 'Previous')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={handleToggleRecording}
          disabled={isProcessing}
          className="rounded-full h-16 w-16 p-0 shadow-lg"
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            const targetSentence = Math.min(sentences.length - 1, currentSentenceIndex + 1);
            const target = sentences[targetSentence]?.startIndex ?? currentWordIndex;
            prevWordIndexRef.current = target;
            currentWordIndexRef.current = target;
            setCurrentWordIndex(target);
            setShowHint(null);
          }}
          disabled={currentSentenceIndex >= sentences.length - 1}
          className="rounded-full h-12 w-12 p-0 shadow-md"
          aria-label={t('common.next', 'Next')}
        >
          <ChevronRight className="h-5 w-5" />
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
