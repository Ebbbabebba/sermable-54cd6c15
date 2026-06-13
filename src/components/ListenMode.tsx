import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, Ear } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { isHardToRecognizeWord } from "@/utils/wordRecognition";

interface ListenSessionResult {
  durationSeconds: number;
  accuracy: number;
  hesitations: number;
  missedWords: string[];
  matchedCount: number;
  totalWords: number;
}

interface ListenModeProps {
  text: string;
  speechLanguage: string;
  onExit: () => void;
  onComplete?: (result: ListenSessionResult) => void;
}


const getRecognitionLanguage = (lang: string): string => {
  if (!lang) return "en-US";
  if (lang.includes("-") || lang.includes("_")) return lang.replace("_", "-");
  const map: Record<string, string> = {
    en: "en-US", sv: "sv-SE", de: "de-DE", fr: "fr-FR",
    es: "es-ES", it: "it-IT", pt: "pt-PT",
  };
  return map[lang.toLowerCase()] || `${lang}-${lang.toUpperCase()}`;
};

const normalizeWord = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

const getWordSimilarity = (w1: string, w2: string): number => {
  const a = normalizeWord(w1);
  const b = normalizeWord(w2);
  if (a === b) return 1.0;
  if (a.length <= 2 || b.length <= 2) return a === b ? 1.0 : 0.0;
  const maxLen = Math.max(a.length, b.length);
  const minLen = Math.min(a.length, b.length);
  if (minLen / maxLen >= 0.7 && (a.startsWith(b) || b.startsWith(a))) return 0.85;
  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / maxLen;
};

// Tighter matching so wrong sentences don't race the cursor forward, but
// lenient enough that recognition mishears don't keep stalling the user.
const SIMILARITY_THRESHOLD = 0.65;
const LOOKAHEAD_THRESHOLD = 0.72;
const LOOKAHEAD_WORDS = 3;
// After this many ms of being stuck on the same word while the user is still
// talking, advance the cursor automatically so the session keeps moving.
const STALL_AUTO_ADVANCE_MS = 5000;


// Hint escalation thresholds
const HINT_STAGE_1_MS = 2000; // show next 3 words
const HINT_STAGE_2_MS = 4000; // show rest of current sentence
const HINT_STAGE_3_MS = 6000; // also reveal the word after

const ListenMode = ({ text, speechLanguage, onExit, onComplete }: ListenModeProps) => {
  const { t } = useTranslation();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const [isRecording, setIsRecording] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hintStage, setHintStage] = useState<0 | 1 | 2 | 3>(0);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<any>(null);
  const currentIndexRef = useRef(0);
  const lastSpeechAtRef = useRef<number>(Date.now());
  const lastProcessedInterimRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const restartAttemptsRef = useRef(0);

  // Scoring refs
  const matchedCountRef = useRef(0); // words advanced by real recognition match
  const missedIndicesRef = useRef<Set<number>>(new Set()); // word indices the user skipped over
  const hesitationsRef = useRef(0); // times any hint stage was shown
  const lastProgressAtRef = useRef<number>(Date.now()); // last cursor advance (for stall detection)

  // Sync ref
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Match incoming spoken words to script with tightened lookahead
  const processSpoken = useCallback((spoken: string) => {
    const tokens = spoken.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let idx = currentIndexRef.current;
    let progressed = false;
    let matchedDelta = 0;

    for (const tok of tokens) {
      if (idx >= words.length) break;
      const target = words[idx];
      const hard = isHardToRecognizeWord(target);
      const sim = hard ? 1.0 : getWordSimilarity(tok, target);

      if (sim >= SIMILARITY_THRESHOLD) {
        idx++;
        matchedDelta++;
        progressed = true;
        continue;
      }
      // Lookahead — allow jumping over a few words on a strong match.
      let jumped = false;
      for (let i = 1; i <= LOOKAHEAD_WORDS && idx + i < words.length; i++) {
        const aheadHard = isHardToRecognizeWord(words[idx + i]);
        const aheadSim = aheadHard ? 1.0 : getWordSimilarity(tok, words[idx + i]);
        if (aheadSim >= LOOKAHEAD_THRESHOLD) {
          // Words that were skipped over count as missed.
          for (let j = 0; j < i; j++) missedIndicesRef.current.add(idx + j);
          idx = idx + i + 1;
          matchedDelta++;
          progressed = true;
          jumped = true;
          break;
        }
      }
      if (!jumped) {
        // ignore — could be filler word
      }
    }

    if (progressed) {
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      setHintStage(0);
      lastSpeechAtRef.current = Date.now();
      lastProgressAtRef.current = Date.now();
      matchedCountRef.current += matchedDelta;
    }
  }, [words]);


  // Speech recognition setup
  useEffect(() => {
    if (!isRecording) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = getRecognitionLanguage(speechLanguage);
    rec.maxAlternatives = 3;

    rec.onstart = () => { restartAttemptsRef.current = 0; };
    // Only mark "speech detected" when the engine signals real speech onset —
    // NOT on every interim result (which fire continuously and would mask silence).
    rec.onspeechstart = () => { lastSpeechAtRef.current = Date.now(); };

    rec.onresult = (event: any) => {
      let finalT = "";
      let interimT = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const tr = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalT += tr + " ";
        else interimT += tr;
      }

      // Process only the new tail of interim transcripts.
      if (interimT && interimT !== lastProcessedInterimRef.current) {
        const prevWords = lastProcessedInterimRef.current.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const curWords = interimT.toLowerCase().trim().split(/\s+/).filter(Boolean);
        if (curWords.length > prevWords.length) {
          const toProcess = curWords.slice(prevWords.length);
          if (toProcess.length) processSpoken(toProcess.join(" "));
        }
        lastProcessedInterimRef.current = interimT;
      }

      if (finalT) {
        processSpoken(finalT);
        lastProcessedInterimRef.current = "";
      }
      // NOTE: do not update lastSpeechAtRef here — only processSpoken (on real
      // matches) and onspeechstart should reset the silence clock.
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Speech recognition error:", e.error);
      }
    };

    rec.onend = () => {
      if (isRecording && restartAttemptsRef.current < 10) {
        restartAttemptsRef.current++;
        setTimeout(() => {
          if (isRecording && recognitionRef.current) {
            try { rec.start(); } catch {}
          }
        }, 300);
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch {}

    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [isRecording, speechLanguage, processSpoken]);

  // Silence detector → escalate hint stage as silence grows
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      if (currentIndexRef.current >= words.length) return;
      const silence = Date.now() - lastSpeechAtRef.current;

      let nextStage: 0 | 1 | 2 | 3 = 0;
      if (silence >= HINT_STAGE_3_MS) nextStage = 3;
      else if (silence >= HINT_STAGE_2_MS) nextStage = 2;
      else if (silence >= HINT_STAGE_1_MS) nextStage = 1;

      setHintStage(prev => (prev !== nextStage ? nextStage : prev));
    }, 200);
    return () => clearInterval(interval);
  }, [isRecording, words.length]);

  // Reset hint when index advances
  useEffect(() => {
    setHintStage(0);
  }, [currentIndex]);

  // Timer
  useEffect(() => {
    if (!isRecording) return;
    startTimeRef.current = Date.now();
    setElapsed(0);
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [isRecording]);

  const handleStart = () => {
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    lastSpeechAtRef.current = Date.now();
    lastProcessedInterimRef.current = "";
    setHintStage(0);
    setIsRecording(true);
  };

  const handleStop = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    onComplete?.(elapsed);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Compute hint content based on stage
  const hintContent = useMemo(() => {
    if (hintStage === 0 || currentIndex >= words.length) return null;

    if (hintStage === 1) {
      return words.slice(currentIndex, currentIndex + 3).join(" ");
    }

    // Stage 2 & 3 — reveal up to the end of the current sentence.
    let end = currentIndex;
    while (end < words.length && end < currentIndex + 14) {
      end++;
      if (/[.!?]$/.test(words[end - 1])) break;
    }
    let sentence = words.slice(currentIndex, end).join(" ");

    if (hintStage === 3 && end < words.length) {
      sentence += `   →   ${words[end]}`;
    }
    return sentence;
  }, [hintStage, currentIndex, words]);

  const progress = words.length > 0 ? Math.round((currentIndex / words.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4 mr-2" />
          {t("common.exit", "Exit")}
        </Button>
        <div className="text-center">
          <div className="text-xl font-mono font-bold">{formatTime(elapsed)}</div>
          <div className="text-xs text-muted-foreground">{progress}%</div>
        </div>
        <div className="w-16" />
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted">
        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {!isRecording ? (
          <div className="space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Ear className="w-10 h-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{t("listenMode.title", "Listen Mode")}</h2>
              <p className="text-muted-foreground">
                {t(
                  "listenMode.intro",
                  "Speak freely. The screen stays empty — if you pause for 2 seconds, your next words will appear."
                )}
              </p>
            </div>
            <Button size="lg" onClick={handleStart} className="gap-2 px-8">
              <Mic className="h-5 w-5" />
              {t("listenMode.start", "Start")}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-3xl min-h-[200px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {hintStage > 0 && hintContent ? (
                <motion.div
                  key={`hint-${currentIndex}-${hintStage}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">
                    {hintStage === 1
                      ? t("listenMode.nextWords", "Next words")
                      : hintStage === 2
                        ? t("listenMode.nextSentence", "Next sentence")
                        : t("listenMode.fullHint", "Full hint")}
                  </p>
                  <p className={cn(
                    "font-semibold leading-snug",
                    hintStage === 1 ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
                  )}>
                    {hintContent}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="listening"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4"
                >
                  <motion.div
                    className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Ear className="w-10 h-10 text-primary" />
                  </motion.div>
                  <p className="text-muted-foreground">
                    {t("listenMode.listening", "Listening… speak when ready")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      {isRecording && (
        <div className="p-6 border-t flex flex-col items-center gap-3">
          <Button size="lg" variant="destructive" onClick={handleStop} className="gap-2 px-8">
            <Square className="h-5 w-5" />
            {t("listenMode.stop", "Stop")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("listenMode.tip", "Pause 2s to see the next words")}
          </p>
        </div>
      )}
    </div>
  );
};

export default ListenMode;
