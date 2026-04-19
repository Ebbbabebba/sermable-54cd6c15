import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Mic, Square, X, Ear } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { isHardToRecognizeWord } from "@/utils/wordRecognition";

interface ListenModeProps {
  text: string;
  speechLanguage: string;
  onExit: () => void;
  onComplete?: (durationSeconds: number) => void;
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

const SILENCE_HINT_MS = 2000;
const HINT_WORD_COUNT = 4; // how many upcoming words to reveal as a hint

const ListenMode = ({ text, speechLanguage, onExit, onComplete }: ListenModeProps) => {
  const { t } = useTranslation();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  const [isRecording, setIsRecording] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<any>(null);
  const currentIndexRef = useRef(0);
  const lastSpeechAtRef = useRef<number>(Date.now());
  const lastProcessedInterimRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const restartAttemptsRef = useRef(0);

  // Sync ref
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // Match incoming spoken words to script with generous lookahead
  const processSpoken = useCallback((spoken: string) => {
    const tokens = spoken.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let idx = currentIndexRef.current;
    let progressed = false;

    for (const tok of tokens) {
      if (idx >= words.length) break;
      const target = words[idx];
      const hard = isHardToRecognizeWord(target);
      const sim = hard ? 1.0 : getWordSimilarity(tok, target);

      if (sim >= 0.5) {
        idx++;
        progressed = true;
        continue;
      }
      // Lookahead — allow user to jump over words
      let jumped = false;
      for (let i = 1; i <= 8 && idx + i < words.length; i++) {
        if (getWordSimilarity(tok, words[idx + i]) >= 0.5) {
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
      setHintShown(false);
      lastSpeechAtRef.current = Date.now();
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
    rec.onspeechstart = () => { lastSpeechAtRef.current = Date.now(); };

    rec.onresult = (event: any) => {
      let finalT = "";
      let interimT = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const tr = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalT += tr + " ";
        else interimT += tr;
      }

      lastSpeechAtRef.current = Date.now();

      if (interimT && interimT !== lastProcessedInterimRef.current) {
        const prevWords = lastProcessedInterimRef.current.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const curWords = interimT.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const toProcess = curWords.length > prevWords.length
          ? curWords.slice(prevWords.length)
          : curWords.slice(Math.max(0, curWords.length - 3));
        if (toProcess.length) processSpoken(toProcess.join(" "));
        lastProcessedInterimRef.current = interimT;
      }

      if (finalT) {
        processSpoken(finalT);
        lastProcessedInterimRef.current = "";
      }
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

  // Silence detector → reveal hint after 2s
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      if (currentIndexRef.current >= words.length) return;
      const silence = Date.now() - lastSpeechAtRef.current;
      if (silence >= SILENCE_HINT_MS) {
        setHintShown(true);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isRecording, words.length]);

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
    setHintShown(false);
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

  // Words to reveal as a hint
  const hintWords = words.slice(currentIndex, currentIndex + HINT_WORD_COUNT).join(" ");
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
              {hintShown && currentIndex < words.length ? (
                <motion.div
                  key={`hint-${currentIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">
                    {t("listenMode.nextWords", "Next words")}
                  </p>
                  <p className="text-3xl md:text-4xl font-semibold leading-snug">
                    {hintWords}
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
