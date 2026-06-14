import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, Ear } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { isHardToRecognizeWord, isStrongSpeechFragmentMatch } from "@/utils/wordRecognition";

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

const getWordDistance = (a: string, b: string): number => {
  if (a === b) return 1.0;
  if (!a) return b.length;
  if (!b) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
};

const getWordSimilarity = (w1: string, w2: string): number => {
  if (isStrongSpeechFragmentMatch(w1, w2)) return 1.0;
  const a = normalizeWord(w1);
  const b = normalizeWord(w2);
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  if (a.length <= 2 || b.length <= 2) return a === b ? 1.0 : 0.0;
  if (a.length >= b.length + 2 && a.includes(b)) return 0.9;
  if (b.length >= a.length + 2 && b.includes(a) && a.length >= Math.max(3, b.length - 2)) return 0.86;
  if (a[0] !== b[0] && a[1] !== b[1]) return 0.0;

  const maxLen = Math.max(a.length, b.length);
  const distance = getWordDistance(a, b);
  return Math.max(0, 1 - distance / maxLen);
};

const SIMILARITY_THRESHOLD = 0.7;
const LOOKAHEAD_THRESHOLD = 0.82;
const LOOKAHEAD_WORDS = 6;
const STALL_AUTO_ADVANCE_MS = 4500;


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
  const matchedIndicesRef = useRef<Set<number>>(new Set()); // words actually matched by recognition
  const missedIndicesRef = useRef<Set<number>>(new Set()); // word indices the user skipped over
  const hesitationsRef = useRef(0); // times any hint stage was shown
  const lastProgressAtRef = useRef<number>(Date.now()); // last cursor advance (for stall detection)
  const hasSpeechSinceProgressRef = useRef(false);

  // Sync ref
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Match incoming spoken words to script with tightened lookahead
  const processSpoken = useCallback((spoken: string) => {
    const tokens = spoken.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let idx = currentIndexRef.current;
    let progressed = false;

    for (const tok of tokens) {
      if (idx >= words.length) break;
      const target = words[idx];
      const hard = isHardToRecognizeWord(target);
      const sim = hard ? 1.0 : getWordSimilarity(tok, target);

      if (sim >= SIMILARITY_THRESHOLD) {
        if (!hard) matchedIndicesRef.current.add(idx);
        idx++;
        progressed = true;
        continue;
      }
      // Lookahead — allow jumping over a few words on a strong match.
      let jumped = false;
      for (let i = 1; i <= LOOKAHEAD_WORDS && idx + i < words.length; i++) {
        const aheadHard = isHardToRecognizeWord(words[idx + i]);
        const aheadSim = aheadHard ? 0 : getWordSimilarity(tok, words[idx + i]);
        if (aheadSim >= LOOKAHEAD_THRESHOLD) {
          // Words that were skipped over count as missed.
          for (let j = 0; j < i; j++) missedIndicesRef.current.add(idx + j);
          matchedIndicesRef.current.add(idx + i);
          idx = idx + i + 1;
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
      hasSpeechSinceProgressRef.current = false;
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
    rec.onspeechstart = () => {
      lastSpeechAtRef.current = Date.now();
      hasSpeechSinceProgressRef.current = true;
    };

    rec.onresult = (event: any) => {
      let finalT = "";
      let interimT = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const tr = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalT += tr + " ";
        else interimT += tr;
      }
      if (finalT || interimT) hasSpeechSinceProgressRef.current = true;

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

  // Silence + stall detector → escalate hint, and auto-advance if the user
  // is talking but recognition can't catch up (cursor stuck on same word).
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      if (currentIndexRef.current >= words.length) return;
      const now = Date.now();
      const silence = now - lastSpeechAtRef.current;
      const sinceProgress = now - lastProgressAtRef.current;

      let nextStage: 0 | 1 | 2 | 3 = 0;
      if (silence >= HINT_STAGE_3_MS) nextStage = 3;
      else if (silence >= HINT_STAGE_2_MS) nextStage = 2;
      else if (silence >= HINT_STAGE_1_MS) nextStage = 1;

      // If the user IS speaking (silence is low) but the cursor hasn't moved
      // for a while, still surface a hint so they aren't stranded.
      if (nextStage === 0 && sinceProgress >= HINT_STAGE_1_MS + 1000) {
        nextStage = 1;
      }

      setHintStage(prev => (prev !== nextStage ? nextStage : prev));

      // Stall auto-advance only after actual speech. Silence should reveal hints,
      // not move the cursor by itself.
      if (hasSpeechSinceProgressRef.current && sinceProgress >= STALL_AUTO_ADVANCE_MS) {
        const idx = currentIndexRef.current;
        if (idx < words.length) {
          missedIndicesRef.current.add(idx);
          const next = idx + 1;
          currentIndexRef.current = next;
          setCurrentIndex(next);
          lastProgressAtRef.current = now;
          hasSpeechSinceProgressRef.current = false;
        }
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isRecording, words.length]);

  // Count hesitations whenever a hint becomes visible
  const prevHintRef = useRef<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    if (hintStage > 0 && prevHintRef.current === 0) {
      hesitationsRef.current += 1;
    }
    prevHintRef.current = hintStage;
  }, [hintStage]);

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
    lastProgressAtRef.current = Date.now();
    lastProcessedInterimRef.current = "";
    matchedIndicesRef.current = new Set();
    missedIndicesRef.current = new Set();
    hesitationsRef.current = 0;
    prevHintRef.current = 0;
    hasSpeechSinceProgressRef.current = false;
    setHintStage(0);
    setIsRecording(true);
  };

  const handleStop = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }

    // Words from current cursor to end of script were never reached → missed.
    for (let i = currentIndexRef.current; i < words.length; i++) {
      missedIndicesRef.current.add(i);
    }

    const total = words.length;
    const matched = matchedIndicesRef.current.size;
    const accuracy = total > 0 ? Math.round((matched / total) * 1000) / 10 : 0;
    const missedWords = Array.from(missedIndicesRef.current)
      .sort((a, b) => a - b)
      .map((i) => words[i])
      .filter(Boolean);

    onComplete?.({
      durationSeconds: elapsed,
      accuracy,
      hesitations: hesitationsRef.current,
      missedWords,
      matchedCount: matched,
      totalWords: total,
    });
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
