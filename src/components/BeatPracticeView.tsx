import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, Sparkles, CheckCircle2, ChevronRight, GraduationCap, FileText, Medal, X, Circle, Coffee, Play, BookOpen, Eye, Bell, Lock, AlertTriangle, Crown, Pencil, FastForward } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { isHardToRecognizeWord } from "@/utils/wordRecognition";
import BeatProgress from "./BeatProgress";
import SentenceDisplay from "./SentenceDisplay";
import { motion, AnimatePresence } from "framer-motion";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { PremiumUpgradeDialog } from "./PremiumUpgradeDialog";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as NativeSpeech } from "@capacitor-community/speech-recognition";

import { PauseCountdownOverlay } from "./PauseCountdownOverlay";
import { scheduleNextReview } from "@/lib/scheduleNextReview";
import { getHesitationThresholdMs } from "@/lib/practicePrefs";

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface Beat {
  id: string;
  beat_order: number;
  sentence_1_text: string;
  sentence_2_text: string;
  sentence_3_text: string;
  is_mastered: boolean;
  mastered_at: string | null;
  last_recall_at: string | null;
  recall_10min_at: string | null;
  recall_evening_at: string | null;
  recall_morning_at: string | null;
  recall_session_number?: number;
  next_scheduled_recall_at?: string | null;
  last_merged_recall_at?: string | null;
  checkpoint_sentence?: number | null;
  checkpoint_phase?: string | null;
  checkpoint_hidden_indices?: number[] | null;
  passed_in_full_speech?: boolean;
  recent_failure_count?: number;
  last_failure_at?: string | null;
  cooldown_until?: string | null;
  total_successful_recalls?: number;
}

// 2/3/5/7 spaced repetition intervals (days between sessions)
const SPACED_REPETITION_INTERVALS = [0, 0, 2, 3, 5, 7, 7, 7]; // session 0-1 = same day (10min/evening/morning), then 2/3/5/7 day gaps

/**
 * Calculate next recall date using 2/3/5/7 spaced repetition schedule.
 * Compresses intervals proportionally when a deadline is close.
 */
const calculateNextRecallDate = (
  sessionNumber: number, 
  lastRecallAt: Date, 
  goalDate: Date | null,
  preferredHours?: number[] | null,
  fallbackHour: number = 8
): Date | null => {
  // Sessions 0-1 are handled by 10min/evening/morning recalls
  if (sessionNumber < 2) return null;
  
  const intervalIndex = Math.min(sessionNumber, SPACED_REPETITION_INTERVALS.length - 1);
  let intervalDays = SPACED_REPETITION_INTERVALS[intervalIndex];
  
  // Compress intervals if deadline is close
  if (goalDate) {
    const now = new Date();
    const totalDaysRemaining = Math.max(1, Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    let totalRemainingIntervals = 0;
    for (let i = intervalIndex; i < SPACED_REPETITION_INTERVALS.length; i++) {
      totalRemainingIntervals += SPACED_REPETITION_INTERVALS[i];
    }
    
    if (totalRemainingIntervals > 0 && totalDaysRemaining < totalRemainingIntervals) {
      const compressionRatio = totalDaysRemaining / totalRemainingIntervals;
      intervalDays = Math.max(1, Math.round(intervalDays * compressionRatio));
    }
  }
  
  if (intervalDays <= 0) return null;
  
  const nextDate = new Date(lastRecallAt);
  nextDate.setDate(nextDate.getDate() + intervalDays);

  // PREDICTIVE RESCHEDULING: snap to user's best practice hour.
  // preferredHours comes from user_learning_analytics; fall back to profile's
  // practice_start_hour, then 8 AM.
  const validHours = (preferredHours ?? [])
    .filter(h => Number.isFinite(h) && h >= 0 && h <= 23)
    .sort((a, b) => a - b);
  const targetHour = validHours[0] ?? fallbackHour;
  nextDate.setHours(targetHour, 0, 0, 0);
  return nextDate;
};

// HYBRID ENDURANCE DRILLS: select which beats merge into a "full" recall.
// On even drill counts, run the entire speech (full endurance).
// On odd drill counts (with ≥4 mastered beats and identifiable weak beats),
// run a spot-reinforcement merge: weak beats + the ending. This builds
// fluency without forcing a full slog every single time.
const selectBeatsForEnduranceDrill = (
  masteredBeats: Beat[],
  drillCounter: number
): { beats: Beat[]; isFullSpeech: boolean } => {
  const sorted = [...masteredBeats].sort((a, b) => a.beat_order - b.beat_order);
  if (sorted.length < 4 || drillCounter % 2 === 0) {
    return { beats: sorted, isFullSpeech: true };
  }

  // Identify weak beats: in cooldown, recent failures, or low success count.
  const now = Date.now();
  const isWeak = (b: Beat) =>
    (b.recent_failure_count ?? 0) > 0 ||
    (b.cooldown_until && new Date(b.cooldown_until).getTime() > now) ||
    (b.total_successful_recalls ?? 0) < 2;

  const weakBeats = sorted.filter(isWeak);
  if (weakBeats.length === 0) {
    return { beats: sorted, isFullSpeech: true };
  }

  // Spot-reinforcement merge: weak beats + last 2 beats (ending), de-duped, ordered.
  const endingBeats = sorted.slice(-2);
  const idSet = new Set<string>();
  const merged: Beat[] = [];
  for (const b of [...weakBeats, ...endingBeats].sort((a, b) => a.beat_order - b.beat_order)) {
    if (!idSet.has(b.id)) {
      idSet.add(b.id);
      merged.push(b);
    }
  }
  // Safety: if we ended up with most beats anyway, just do a full pass.
  if (merged.length >= sorted.length - 1) {
    return { beats: sorted, isFullSpeech: true };
  }
  return { beats: merged, isFullSpeech: false };
};

interface BeatPracticeViewProps {
  speechId: string;
  subscriptionTier?: 'free' | 'student' | 'regular' | 'enterprise';
  fullSpeechText?: string; // Full speech text for "Show Whole Speech" modal
  onComplete?: () => void;
  onExit?: () => void;
  onSessionLimitReached?: () => void; // Called when free user hits daily limit
  onEditScript?: () => void; // Called when user wants to edit the script inline
}

type Phase = 'sentence_1_learning' | 'sentence_1_fading' | 'sentence_2_learning' | 'sentence_2_fading' | 'sentences_1_2_learning' | 'sentences_1_2_fading' | 'sentence_3_learning' | 'sentence_3_fading' | 'beat_learning' | 'beat_fading';

// Session modes: recall (quick review of mastered beats), learn (learning a new beat), beat_rest (pause between beats), pre_beat_recall (recall previous beat before learning new), beat_preview (preview upcoming beat before learning)
type SessionMode = 'recall' | 'learn' | 'beat_rest' | 'pre_beat_recall' | 'beat_preview' | 'coffee_break' | 'session_complete';

// Always 10 minutes coffee break after mastering a beat
// Follows spaced repetition: short break helps consolidation
// After the break, a quick recall of the just-mastered beat is triggered automatically
const calculateRestMinutes = (_daysUntilDeadline: number): number => {
  return 10; // Always 10 minutes coffee break
};

// Countdown timer component for rest screen
const RestCountdown = ({ 
  targetTime, 
  onComplete, 
  restMinutes 
}: { 
  targetTime: Date; 
  onComplete: () => void; 
  restMinutes: number;
}) => {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = targetTime.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 1000));
  });
  
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = targetTime.getTime() - Date.now();
      const newTimeLeft = Math.max(0, Math.ceil(diff / 1000));
      setTimeLeft(newTimeLeft);
      
      if (newTimeLeft <= 0) {
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [targetTime, onComplete]);
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress = 1 - (timeLeft / (restMinutes * 60));
  
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-32 h-32">
        {/* Background circle */}
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${progress * 283} 283`}
            className="text-amber-500 transition-all duration-1000"
            strokeLinecap="round"
          />
        </svg>
        {/* Time display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold tabular-nums">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};

// Map language code to speech recognition locale for accurate transcription
const getRecognitionLocale = (lang: string): string => {
  const localeMap: Record<string, string> = {
    'sv': 'sv-SE',
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
  };
  return localeMap[lang] || lang || 'en-US';
};

// Gap/filler words that are ALWAYS hidden from the start.
// Covers EN, SV, DE, FR, ES, IT, PT — entries are pre-normalized
// (lowercased, diacritics stripped) so they match normalizeWord() output.
const COMMON_WORDS = new Set([
  // English
  'the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with',
  'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'or', 'but', 'so', 'if', 'not', 'no', 'yes', 'up', 'out', 'from',
  // Swedish
  'och', 'i', 'pa', 'att', 'en', 'ett', 'av', 'for', 'med', 'som', 'ar', 'var',
  'den', 'det', 'de', 'om', 'till', 'fran', 'har', 'kan', 'ska', 'vill',
  'men', 'eller', 'sa', 'nar', 'dar', 'har', 'inte', 'bara', 'aven', 'ocksa',
  'vi', 'jag', 'du', 'han', 'hon', 'ni', 'sin', 'sitt', 'sina',
  'min', 'mitt', 'mina', 'din', 'ditt', 'dina', 'er', 'ert', 'era', 'var', 'vart', 'vara',
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'doch', 'denn', 'weil', 'wenn', 'als', 'wie', 'wo', 'da',
  'ist', 'sind', 'war', 'waren', 'sein', 'hat', 'haben', 'hatte', 'wird', 'werden',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'sich', 'mir', 'dir',
  'mit', 'von', 'zu', 'zum', 'zur', 'auf', 'in', 'im', 'an', 'am', 'bei', 'fur', 'uber', 'unter',
  'nicht', 'nur', 'auch', 'noch', 'schon', 'sehr', 'mehr',
  // French
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'car', 'si', 'que', 'qui', 'quoi', 'ou', 'quand',
  'est', 'sont', 'etait', 'etaient', 'etre', 'a', 'ont', 'avoir', 'avait',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se',
  'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses', 'notre', 'votre', 'leur',
  'ce', 'cet', 'cette', 'ces', 'dans', 'sur', 'sous', 'par', 'pour', 'avec', 'sans',
  'ne', 'pas', 'plus', 'tres', 'aussi', 'encore', 'deja',
  // Spanish
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al',
  'y', 'o', 'pero', 'porque', 'si', 'que', 'cuando', 'donde', 'como',
  'es', 'son', 'era', 'eran', 'ser', 'esta', 'estan', 'estaba', 'ha', 'han', 'habia',
  'yo', 'tu', 'el', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te', 'se',
  'mi', 'tu', 'su', 'sus', 'nuestro', 'vuestro',
  'en', 'con', 'sin', 'por', 'para', 'sobre', 'entre', 'hasta', 'desde',
  'no', 'si', 'mas', 'muy', 'tambien', 'tan', 'ya',
  // Italian
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'del', 'della', 'dei', 'delle',
  'e', 'o', 'ma', 'pero', 'perche', 'se', 'che', 'chi', 'quando', 'dove', 'come',
  'e', 'sono', 'era', 'erano', 'essere', 'ha', 'hanno', 'aveva', 'avere',
  'io', 'tu', 'lui', 'lei', 'noi', 'voi', 'loro', 'mi', 'ti', 'si', 'ci', 'vi',
  'mio', 'tuo', 'suo', 'nostro', 'vostro',
  'in', 'con', 'su', 'per', 'tra', 'fra', 'da', 'a',
  'non', 'si', 'piu', 'molto', 'anche', 'gia', 'ancora',
  // Portuguese
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
  'e', 'ou', 'mas', 'porque', 'se', 'que', 'quem', 'quando', 'onde', 'como',
  'e', 'sao', 'era', 'eram', 'ser', 'esta', 'estao', 'tem', 'tinha', 'ter',
  'eu', 'tu', 'ele', 'ela', 'nos', 'vos', 'eles', 'elas', 'me', 'te', 'se',
  'meu', 'teu', 'seu', 'nosso', 'vosso',
  'em', 'no', 'na', 'com', 'sem', 'por', 'para', 'sobre',
  'nao', 'sim', 'mais', 'muito', 'tambem', 'ja', 'ainda',
]);

// Check if it's a new calendar day (for 1 beat per day logic)
const isNewDay = (lastPractice: Date | null): boolean => {
  if (!lastPractice) return true;
  const today = new Date();
  return lastPractice.toDateString() !== today.toDateString();
};

// Calculate how many beats we need per day given deadline
const calculateBeatsPerDay = (unmasteredCount: number, daysUntilDeadline: number): number => {
  if (daysUntilDeadline <= 0) return unmasteredCount; // Deadline passed or today - learn all
  if (daysUntilDeadline >= unmasteredCount) return 1; // Plenty of time - 1 per day
  // Tight deadline: distribute remaining beats across remaining days
  return Math.ceil(unmasteredCount / daysUntilDeadline);
};

const BeatPracticeView = ({ speechId, subscriptionTier = 'free', fullSpeechText, onComplete, onExit, onSessionLimitReached, onEditScript }: BeatPracticeViewProps) => {
  const { t } = useTranslation();
  const isPremium = subscriptionTier !== 'free';
  
  // Full speech modal state
  const [showFullSpeechModal, setShowFullSpeechModal] = useState(false);
  
  // Sound effects
  const soundEnabled = typeof localStorage !== 'undefined' ? localStorage.getItem('soundEnabled') !== 'false' : true;
  const { playClick } = useSoundEffects({ enabled: soundEnabled });
  
  // Beats data
  const [beats, setBeats] = useState<Beat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speechLang, setSpeechLang] = useState<string>(() => (typeof navigator !== 'undefined' ? navigator.language : 'en-US'));
  const [practiceStrictness, setPracticeStrictness] = useState<'strict' | 'flow'>('strict');
  const [familiarityLevel, setFamiliarityLevel] = useState<'beginner' | 'intermediate' | 'confident'>('beginner');
  
  // Calculate words to hide per successful repetition based on familiarity
  const wordsToHidePerSuccess = familiarityLevel === 'confident' ? 3 : familiarityLevel === 'intermediate' ? 2 : 1;
  // requiredLearningReps is computed after `phase` is declared (see below).
  
  // Session mode tracking
  const [sessionMode, setSessionMode] = useState<SessionMode>('recall');
  const [beatsToRecall, setBeatsToRecall] = useState<Beat[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallSuccessCount, setRecallSuccessCount] = useState(0);
  const [newBeatToLearn, setNewBeatToLearn] = useState<Beat | null>(null);
  const [daysUntilDeadline, setDaysUntilDeadline] = useState(30);
  const [beatsPerDay, setBeatsPerDay] = useState(1);
  const [is10MinRecall, setIs10MinRecall] = useState(false); // Track if current recall is 10-min recall
  const [goalDate, setGoalDate] = useState<Date | null>(null);
  const [isMergedRecall, setIsMergedRecall] = useState(false); // Track if current recall is a merged recall
  const [mergedRecallBeats, setMergedRecallBeats] = useState<Beat[]>([]); // Beats included in merged recall
  const [isEndOfSessionRecall, setIsEndOfSessionRecall] = useState(false); // 10-min recall before session_complete
  // Predictive rescheduling: user's best practice hours (from analytics or profile)
  const [preferredPracticeHours, setPreferredPracticeHours] = useState<number[]>([]);
  const [fallbackPracticeHour, setFallbackPracticeHour] = useState<number>(8);
  // Hybrid endurance drills: alternate full-speech vs spot-reinforcement merges
  const [enduranceDrillCounter, setEnduranceDrillCounter] = useState<number>(0);
  const [showSkipWarning, setShowSkipWarning] = useState(false); // Warning dialog for skipping coffee break
  const [showCoffeePremiumUpsell, setShowCoffeePremiumUpsell] = useState(false); // Free-user upsell when tapping skip
  const [showPreBeatRecallIntro, setShowPreBeatRecallIntro] = useState(false); // Animated intro before pre-beat recall
  
  // Rest between beats state
  const [restUntilTime, setRestUntilTime] = useState<Date | null>(null);
  const [restMinutes, setRestMinutes] = useState(0);
  const [nextBeatQueued, setNextBeatQueued] = useState<Beat | null>(null);
  
  // Pre-beat recall state - recall the just-mastered beat before starting a new one
  const [beatToRecallBeforeNext, setBeatToRecallBeforeNext] = useState<Beat | null>(null);
  const [preBeatRecallSuccessCount, setPreBeatRecallSuccessCount] = useState(0);
  
  // Phase tracking
  const [phase, setPhase] = useState<Phase>('sentence_1_learning');
  // One clean read-through is enough before fading begins. Stale speech
  // callbacks are blocked separately by the phase epoch + fresh-speech gate,
  // so we don't need to repeat the exact same sentence back-to-back.
  const requiredLearningReps = 1;
  const [repetitionCount, setRepetitionCount] = useState(1);
  const repetitionCountRef = useRef(1);
  
  // Word tracking
  const [hiddenWordIndices, setHiddenWordIndices] = useState<Set<number>>(new Set());
  const [hiddenWordOrder, setHiddenWordOrder] = useState<number[]>([]); // Track order words were hidden
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [spokenIndices, setSpokenIndices] = useState<Set<number>>(new Set());
  const [hesitatedIndices, setHesitatedIndices] = useState<Set<number>>(new Set());
  const [missedIndices, setMissedIndices] = useState<Set<number>>(new Set());
  const [failedWordIndices, setFailedWordIndices] = useState<Set<number>>(new Set()); // Words that had errors
  const [protectedWordIndices, setProtectedWordIndices] = useState<Set<number>>(new Set()); // Words that failed - stay visible, disappear last
  const [lenientWordIndices, setLenientWordIndices] = useState<Set<number>>(new Set()); // Proper nouns/names - hidden but can't turn red
  const lenientWordIndicesRef = useRef<Set<number>>(new Set());
  const [consecutiveNoScriptSuccess, setConsecutiveNoScriptSuccess] = useState(0); // Track 2 successful no-script reps

  // Pause markers (`-`, `-3s`) — full-screen countdown overlay state.
  const [activePause, setActivePause] = useState<{
    remainingSeconds: number;
    totalSeconds: number;
  } | null>(null);
  const triggeredPausesRef = useRef<Set<number>>(new Set());
  const postPauseNoHesitationIndicesRef = useRef<Set<number>>(new Set());
  const pauseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechReady, setIsSpeechReady] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const { toast } = useToast();
  
  // Transcription using Web Speech API
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const transcriptWordsRef = useRef<string[]>([]);
  const runningTranscriptRef = useRef<string>("");
  const latestSpeechResultCountRef = useRef(0);
  const ignoreResultsBeforeIndexRef = useRef(0);
  const lastWordTimeRef = useRef<number>(Date.now());
  const hasHeardSpeechRef = useRef(false);
  // Throttles auto-advance so consecutive hidden words can't cascade — the
  // user must produce fresh speech (or genuinely wait) between advances.
  const lastAutoAdvanceAtRef = useRef<number>(0);
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guards against duplicate "sentence complete" triggers for the same repetition
  const lastCompletionRepIdRef = useRef<number>(-1);

  // Ignore speech results briefly right after we reset / during transitions
  const ignoreResultsUntilRef = useRef(0);

  // When we intentionally abort recognition (to flush stale results), don't restart until this time
  const recognitionRestartAtRef = useRef(0);
  const recognitionRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the repetition number so we can ignore old transcript data after reset
  const repetitionIdRef = useRef(0);
  const lastResetAtRef = useRef(Date.now());
  const staleReplayGuardUntilRef = useRef(0);

  // Bumped on every phase transition. Any in-flight speech callback captures
  // the epoch at call time and bails if it changed — this prevents a buffered
  // sentence-1 transcript from sneaking into sentence-2 and falsely auto-
  // completing the new phase before the user has spoken a word.
  const phaseEpochRef = useRef(0);

  // Set true on every phase transition. Cleared the first time we hear real
  // new speech in this phase. While true, learning-phase auto-completion is
  // blocked so a stale buffered transcript from the previous sentence cannot
  // mark all words spoken and skip the whole sentence.
  const needsFreshSpeechRef = useRef(false);
  // Timestamp of the most recent phase transition. Used together with
  // needsFreshSpeechRef so a stale buffered transcript can never satisfy the
  // fresh-speech gate within the first 500ms after a phase change.
  const phaseTransitionAtRef = useRef(0);

  // Cooldown for "start over" voice command / swipe to avoid double-fire
  const restartCooldownUntilRef = useRef(0);

  // Refs to avoid stale closures in timers / callbacks
  const currentWordIndexRef = useRef(0);
  const isRecordingRef = useRef(false);
  const hiddenWordIndicesRef = useRef<Set<number>>(new Set());
  const spokenIndicesRef = useRef<Set<number>>(new Set());
  const hesitatedIndicesRef = useRef<Set<number>>(new Set());
  const missedIndicesRef = useRef<Set<number>>(new Set());
  const wordsLengthRef = useRef(0);
  const showCelebrationRef = useRef(false);
  const processTranscriptionRef = useRef<
    (transcript: string, isFinal: boolean, repId: number, phaseEpoch?: number) => void
  >(() => {});

  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    hiddenWordIndicesRef.current = hiddenWordIndices;
  }, [hiddenWordIndices]);

  useEffect(() => {
    spokenIndicesRef.current = spokenIndices;
  }, [spokenIndices]);

  useEffect(() => {
    hesitatedIndicesRef.current = hesitatedIndices;
  }, [hesitatedIndices]);

  useEffect(() => {
    missedIndicesRef.current = missedIndices;
  }, [missedIndices]);

  useEffect(() => {
    lenientWordIndicesRef.current = lenientWordIndices;
  }, [lenientWordIndices]);

  // Detect proper nouns and difficult names that speech recognition struggles with
  // These words get hidden but can't turn red - they just move on like visible words
  const detectLenientWords = useCallback((wordList: string[]): Set<number> => {
    const lenient = new Set<number>();
    
    for (let i = 0; i < wordList.length; i++) {
      const word = wordList[i];
      const cleanWord = word.replace(/[^\p{L}]/gu, '');
      
      if (!cleanWord) continue;
      
      // Check if word is capitalized (potential proper noun)
      const isCapitalized = cleanWord[0] === cleanWord[0].toUpperCase() && 
                           cleanWord[0] !== cleanWord[0].toLowerCase();
      
      // Check if it's at sentence start (previous word ends with . ! ?)
      const prevWord = i > 0 ? wordList[i - 1] : '';
      const isAtSentenceStart = i === 0 || /[.!?]$/.test(prevWord);
      
      // Proper noun: capitalized but NOT at sentence start
      if (isCapitalized && !isAtSentenceStart) {
        lenient.add(i);
        continue;
      }
      
      // Sentence-start capitalized word followed by another capitalized word = name
      // e.g. "Ebba Hallert" where "Ebba" starts a sentence
      if (isCapitalized && isAtSentenceStart && i + 1 < wordList.length) {
        const nextWord = wordList[i + 1].replace(/[^\p{L}]/gu, '');
        if (nextWord && nextWord[0] === nextWord[0].toUpperCase() && nextWord[0] !== nextWord[0].toLowerCase()) {
          lenient.add(i);
          continue;
        }
      }
      
      // Multi-part names: look for sequences of capitalized words
      // If previous word was marked as lenient and this is also capitalized
      if (isCapitalized && i > 0 && lenient.has(i - 1)) {
        lenient.add(i);
        continue;
      }
      
      // Unusual character patterns that speech recognition struggles with
      // Words with mixed case in the middle (like "McDonald")
      if (cleanWord.length > 2) {
        const middlePart = cleanWord.slice(1);
        if (/[A-Z]/.test(middlePart)) {
          lenient.add(i);
          continue;
        }
      }
      
      // Names with uncommon letter combinations (Nordic names, etc.)
      // Check for double consonant patterns or unusual vowel patterns
      const uncommonPatterns = /([bcdfghjklmnpqrstvwxz]{3,})|([äöåéèêëïîìíüùúûñçß])/i;
      if (uncommonPatterns.test(cleanWord)) {
        lenient.add(i);
        continue;
      }
    }
    
    return lenient;
  }, []);

  // Get current beat based on session mode
  const currentBeat = sessionMode === 'recall' 
    ? beatsToRecall[recallIndex] 
    : sessionMode === 'pre_beat_recall'
      ? beatToRecallBeforeNext
      : sessionMode === 'learn' 
        ? newBeatToLearn 
        : null;
  // Get unique sentences for this beat (for short speeches, sentences may be duplicated)
  const getUniqueSentences = useCallback((beat: Beat | null): string[] => {
    if (!beat) return [];
    const sentences = [beat.sentence_1_text, beat.sentence_2_text, beat.sentence_3_text];
    // Filter unique sentences while preserving order
    const seen = new Set<string>();
    return sentences.filter(s => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
  }, []);

  // Re-attach any pause tokens (`-`, `-3s`) that immediately follow a
  // sentence in the original full speech text. Beat segmentation strips
  // them, so we splice them back in based on string position.
  const attachTrailingPauses = useCallback((sentence: string): string => {
    if (!fullSpeechText) return sentence;
    const clean = sentence.trim();
    if (!clean) return sentence;
    const idx = fullSpeechText.indexOf(clean);
    if (idx < 0) return sentence;
    const after = fullSpeechText.slice(idx + clean.length);
    const m = after.match(/^(?:\s+-\d{0,2}s?(?=\s|$))+/);
    return m ? `${clean}${m[0]}` : clean;
  }, [fullSpeechText]);

  const joinWithPauses = useCallback((sentences: string[]): string => {
    return sentences.map(attachTrailingPauses).join(' ');
  }, [attachTrailingPauses]);

  // Get current sentence text based on phase
  const getCurrentText = useCallback(() => {
    if (!currentBeat) return "";
    
    const uniqueSentences = getUniqueSentences(currentBeat);
    const uniqueCount = uniqueSentences.length;
    
    // For short speeches with only 1 unique sentence, always show that sentence
    if (uniqueCount === 1) {
      return attachTrailingPauses(uniqueSentences[0]);
    }
    
    // For 2 unique sentences
    if (uniqueCount === 2) {
      // In recall mode or beat phases, show both sentences
      if (sessionMode === 'recall' || phase === 'beat_learning' || phase === 'beat_fading') {
        return joinWithPauses(uniqueSentences);
      }
      // Sentence 1 phases
      if (phase.startsWith('sentence_1')) return attachTrailingPauses(uniqueSentences[0]);
      // Sentence 2 phases - show only sentence 2
      if (phase.startsWith('sentence_2')) return attachTrailingPauses(uniqueSentences[1]);
      // Combining phases - show both
      if (phase.startsWith('sentences_1_2')) {
        return joinWithPauses(uniqueSentences);
      }
      // Sentence 3 phases - for 2 sentences, skip to full beat
      if (phase.startsWith('sentence_3')) return joinWithPauses(uniqueSentences);
      return joinWithPauses(uniqueSentences);
    }
    
    // For 3 unique sentences (normal case)
    if (sessionMode === 'recall') {
      return joinWithPauses(uniqueSentences);
    }
    
    if (phase === 'beat_learning' || phase === 'beat_fading') {
      return joinWithPauses(uniqueSentences);
    }
    
    if (phase === 'sentences_1_2_learning' || phase === 'sentences_1_2_fading') {
      return joinWithPauses([uniqueSentences[0], uniqueSentences[1]]);
    }
    
    if (phase.startsWith('sentence_1')) return attachTrailingPauses(uniqueSentences[0]);
    if (phase.startsWith('sentence_2')) return attachTrailingPauses(uniqueSentences[1]);
    if (phase.startsWith('sentence_3')) return attachTrailingPauses(uniqueSentences[2] || uniqueSentences[1]);
    
    return "";
  }, [currentBeat, phase, sessionMode, getUniqueSentences, attachTrailingPauses, joinWithPauses]);

  // Keep pause markers (`-`, `-3s`) as visible tokens in the word array so
  // they appear inline in the script and turn "spoken" once their timer
  // ends. They are skipped by speech matching (mic is muted while their
  // countdown is running).
  const currentText = getCurrentText();
  const words = useMemo(() => currentText.split(/\s+/).filter(w => w.trim()), [currentText]);
  const PAUSE_TOKEN_RE = /^-(\d{1,2})?s?$/;
  const pauseWordMeta = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>();
    words.forEach((w, i) => {
      const match = w.match(PAUSE_TOKEN_RE);
      if (match) {
        const seconds = match[1] ? parseInt(match[1], 10) : 2;
        const clamped = Math.max(0, Math.min(10, seconds));
        m.set(i, clamped * 1000);
      }
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  useEffect(() => {
    wordsLengthRef.current = words.length;
    // Detect lenient words (proper nouns, difficult names) whenever text changes
    const detected = detectLenientWords(words);
    setLenientWordIndices(detected);
    lenientWordIndicesRef.current = detected;
    if (detected.size > 0) {
      console.log('🏷️ Lenient words detected:', [...detected].map(i => words[i]).join(', '));
    }
  }, [words, detectLenientWords]);

  useEffect(() => {
    showCelebrationRef.current = showCelebration;
  }, [showCelebration]);

  // Reset pause-trigger tracking whenever the active text changes (new
  // beat / phase) — same pause should fire again on the next pass.
  useEffect(() => {
    triggeredPausesRef.current = new Set();
    postPauseNoHesitationIndicesRef.current = new Set();
    setActivePause(null);
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, [currentText]);

  // Cleanup pause timer on unmount.
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
    };
  }, []);

  // Flush buffered transcripts WITHOUT aborting recognition. Aborting + restarting
  // the Web Speech engine triggers the iOS/Safari microphone "ding" sound on every
  // pause, which feels like a constant chime during practice. By keeping the
  // recognizer running and just ignoring incoming results for `pauseMs`, we get
  // the same de-bounce behavior silently.
  const pauseSpeechRecognition = (pauseMs: number) => {
    const until = Date.now() + pauseMs;

    ignoreResultsUntilRef.current = Math.max(ignoreResultsUntilRef.current, until);
    recognitionRestartAtRef.current = Math.max(recognitionRestartAtRef.current, until);

    runningTranscriptRef.current = "";
    transcriptRef.current = "";
    transcriptWordsRef.current = [];
    // Clear native plugin's cumulative finals buffer so old tokens can't
    // leak into the next utterance after the pause window.
    try {
      (recognitionRef.current as { clearBuffer?: () => void } | null)?.clearBuffer?.();
    } catch {
      // Ignore buffer-clear failures; the debounce window still protects us.
    }

    // NOTE: intentionally NOT calling recognitionRef.current.abort() here.
    // The ignoreResultsUntilRef window already discards stale tokens, and skipping
    // the abort avoids the system mic chime that plays on every restart.
  };

  // Trigger a planned pause when the cursor lands on a `-` token. The
  // pause IS the current "word" — we mute the mic, show a full-screen
  // countdown, and on completion mark the dash spoken (gray) and advance
  // the cursor by 1.
  useEffect(() => {
    if (!isRecording) return;
    if (!pauseWordMeta.has(currentWordIndex)) return;
    if (triggeredPausesRef.current.has(currentWordIndex)) return;
    triggeredPausesRef.current.add(currentWordIndex);
    const dur = pauseWordMeta.get(currentWordIndex) ?? 0;
    const pauseIdx = currentWordIndex;

    const finishPause = () => {
      setActivePause(null);
      const nextSpoken = new Set(spokenIndicesRef.current);
      nextSpoken.add(pauseIdx);
      spokenIndicesRef.current = nextSpoken;
      setSpokenIndices(nextSpoken);
      const nextIdx = pauseIdx + 1;
      currentWordIndexRef.current = nextIdx;
      setCurrentWordIndex(nextIdx);
      if (nextIdx < wordsLengthRef.current) {
        postPauseNoHesitationIndicesRef.current.add(nextIdx);
      }
      // Give the word after a planned pause a fresh grace period — otherwise
      // the hesitation timer would see "elapsed since last word" = pause
      // duration (e.g. 3s) and immediately mark the next hidden word yellow.
      lastWordTimeRef.current = Date.now();
      hasHeardSpeechRef.current = false;
      // Drop any buffered transcript so old tokens from before the pause
      // cannot retroactively mark the word after the pause.
      transcriptRef.current = "";
      transcriptWordsRef.current = [];
      runningTranscriptRef.current = "";
      ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current;
      ignoreResultsUntilRef.current = Date.now() + 80;
      recognitionRestartAtRef.current = Math.min(recognitionRestartAtRef.current, Date.now() + 80);
      if (nextIdx >= wordsLengthRef.current) {
        checkCompletion(nextSpoken);
      }
    };

    // 0s pause: just a marker — skip without countdown or muting.
    if (dur <= 0) {
      finishPause();
      return;
    }

    const totalSeconds = Math.round(dur / 1000);
    setActivePause({ remainingSeconds: totalSeconds, totalSeconds });
    pauseSpeechRecognition(dur);
    if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
    const startedAt = Date.now();
    pauseTimerRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = Math.max(0, dur - elapsedMs);
      if (remainingMs <= 0) {
        if (pauseTimerRef.current) {
          clearInterval(pauseTimerRef.current);
          pauseTimerRef.current = null;
        }
        finishPause();
      } else {
        setActivePause({ remainingSeconds: remainingMs / 1000, totalSeconds });
      }
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWordIndex, isRecording, pauseWordMeta]);

  const replayRecentTranscriptTail = (tailWordCount = 6) => {
    const transcript = transcriptRef.current.trim();
    if (!transcript) return;

    const rawWords = transcript.split(/\s+/).filter((w) => w.trim());
    if (rawWords.length === 0) return;

    const replayStart = Math.max(0, rawWords.length - tailWordCount);
    transcriptWordsRef.current = rawWords.slice(0, replayStart);
    processTranscriptionRef.current(transcript, false, repetitionIdRef.current, phaseEpochRef.current);
  };

  // Restart the current rep from the beginning (voice command "börja om" or swipe-down).
  // Keeps the same phase / hidden words — just rewinds the cursor and clears the transcript.
  const restartCurrentBeat = useCallback((reason: 'voice' | 'swipe' | 'manual' = 'manual') => {
    if (showCelebrationRef.current) return;
    const now = Date.now();
    if (now < restartCooldownUntilRef.current) return;
    restartCooldownUntilRef.current = now + 2500;

    console.log(`🔄 Restart current beat (${reason})`);
    playClick();
    pauseSpeechRecognition(600);
    resetForNextRep();
    toast({
      title: t('beat_practice.restarted_title', 'Börja om'),
      description: t('beat_practice.restarted_desc', 'Tar det från början av denna del.'),
    });
  }, [t]);

  const restartCurrentBeatRef = useRef(restartCurrentBeat);
  useEffect(() => {
    restartCurrentBeatRef.current = restartCurrentBeat;
  }, [restartCurrentBeat]);

  // Get sentence number (1, 2, or 3) or combining indicator
  const getCurrentSentenceNumber = () => {
    const uniqueCount = currentBeat ? getUniqueSentences(currentBeat).length : 3;
    if (sessionMode === 'recall') return uniqueCount; // Full beat in recall
    if (phase.startsWith('sentence_1')) return 1;
    if (phase.startsWith('sentence_2')) return 2;
    if (phase.startsWith('sentences_1_2')) return 2; // Show as "after S2"
    if (phase.startsWith('sentence_3')) return 3;
    return uniqueCount; // beat_learning/fading
  };

  // Get phase type (learning, fading, combining)
  const getPhaseType = (): 'learning' | 'fading' | 'combining' => {
    if (sessionMode === 'recall') return 'fading'; // Recall = fully hidden
    if (phase.includes('learning')) return 'learning';
    if (phase.includes('fading')) return 'fading';
    if (phase.includes('combining')) return 'combining';
    return 'combining';
  };

  // Load beats on mount
  useEffect(() => {
    loadOrCreateBeats();
  }, [speechId]);

  const loadOrCreateBeats = async () => {
    setLoading(true);

    // Fetch speech language, last practice time, deadline, and familiarity level
    const { data: speechRow } = await supabase
      .from('speeches')
      .select('speech_language, last_practice_session_at, goal_date, familiarity_level, practice_strictness')
      .eq('id', speechId)
      .single();

    if (speechRow?.speech_language) {
      setSpeechLang(speechRow.speech_language);
    }
    
    // Set familiarity level for adaptive word hiding
    if (speechRow?.familiarity_level) {
      setFamiliarityLevel(speechRow.familiarity_level as 'beginner' | 'intermediate' | 'confident');
    }

    if ((speechRow as any)?.practice_strictness === 'flow') {
      setPracticeStrictness('flow');
    } else {
      setPracticeStrictness('strict');
    }

    // Load user's preferred practice hours for predictive rescheduling.
    // Source 1: user_learning_analytics.preferred_practice_hours (best-performing slots)
    // Source 2: profiles.practice_start_hour (user-set window start) as fallback
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const [analyticsRes, profileRes] = await Promise.all([
          supabase
            .from('user_learning_analytics')
            .select('preferred_practice_hours')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('practice_start_hour')
            .eq('id', user.id)
            .maybeSingle(),
        ]);
        const hours = (analyticsRes.data?.preferred_practice_hours ?? []) as number[];
        if (Array.isArray(hours) && hours.length > 0) {
          setPreferredPracticeHours(hours);
        }
        const fallback = profileRes.data?.practice_start_hour;
        if (typeof fallback === 'number') {
          setFallbackPracticeHour(fallback);
        }
      }
    } catch (err) {
      console.warn('Could not load preferred practice hours:', err);
    }

    // Determine if this is a new day (for 1 beat per day logic)
    const lastPractice = speechRow?.last_practice_session_at 
      ? new Date(speechRow.last_practice_session_at) 
      : null;
    const todayIsNewDay = isNewDay(lastPractice);

    // Calculate days until deadline
    const goalDate = speechRow?.goal_date ? new Date(speechRow.goal_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const computedDaysUntilDeadline = goalDate 
      ? Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 30; // Default to 30 days if no deadline
    
    // Store for later use in rest calculations
    setDaysUntilDeadline(computedDaysUntilDeadline);
    setGoalDate(goalDate);

    const setBeatsAndPlan = (rows: Beat[]) => {
      setBeats(rows);
      
      const now = new Date();
      
      // Helper: a beat is "in cooldown" if cooldown_until is in the future.
      // Cooldown beats skip SOLO recall but still join merged rehearsals.
      const isInCooldown = (b: Beat) => {
        if (!b.cooldown_until) return false;
        return new Date(b.cooldown_until) > now;
      };

      // ADAPTIVE ROTATION: beats at session_number >= 5 (the 7-day rung) have
      // proven durable — drop them from short-cycle 10min/evening/morning/daily
      // rotations. They only resurface on their scheduled ladder or merged recall.
      const isShortCycleEligible = (b: Beat) => (b.recall_session_number ?? 0) < 5;

      // Find mastered beats that need 10-minute recall (recall_10min_at is in the past and not yet recalled)
      const beatsNeeding10MinRecall = rows.filter(b => {
        if (!b.is_mastered || !b.recall_10min_at) return false;
        if (!isShortCycleEligible(b)) return false;
        if (isInCooldown(b)) return false;
        const recall10minTime = new Date(b.recall_10min_at);
        // Need recall if: time has passed AND we haven't recalled since mastery
        // (i.e., last_recall_at is null or before mastered_at)
        if (recall10minTime > now) return false;
        if (!b.last_recall_at) return true;
        if (b.mastered_at && new Date(b.last_recall_at) < new Date(b.mastered_at)) return true;
        return false;
      });
      
      // Find mastered beats that need evening recall (recall_evening_at is in the past and not yet recalled after evening time)
      const beatsNeedingEveningRecall = rows.filter(b => {
        if (!b.is_mastered || !b.recall_evening_at) return false;
        if (!isShortCycleEligible(b)) return false;
        if (isInCooldown(b)) return false;
        // Skip if already in 10-min recall queue
        if (beatsNeeding10MinRecall.some(r => r.id === b.id)) return false;
        const recallEveningTime = new Date(b.recall_evening_at);
        if (recallEveningTime > now) return false;
        // Check if already recalled after the evening time
        if (b.last_recall_at && new Date(b.last_recall_at) >= recallEveningTime) return false;
        return true;
      });
      
      // Find mastered beats that need morning recall (recall_morning_at is in the past and not yet recalled after morning time)
      const beatsNeedingMorningRecall = rows.filter(b => {
        if (!b.is_mastered || !b.recall_morning_at) return false;
        if (!isShortCycleEligible(b)) return false;
        if (isInCooldown(b)) return false;
        // Skip if already in other recall queues
        if (beatsNeeding10MinRecall.some(r => r.id === b.id)) return false;
        if (beatsNeedingEveningRecall.some(r => r.id === b.id)) return false;
        const recallMorningTime = new Date(b.recall_morning_at);
        if (recallMorningTime > now) return false;
        // Check if already recalled after the morning time
        if (b.last_recall_at && new Date(b.last_recall_at) >= recallMorningTime) return false;
        return true;
      });
      
      // Find mastered beats that need regular daily recall (only on new days)
      // Sort by least-recently recalled so we rotate through them instead of
      // always practicing the same beat first.
      const masteredBeats = rows.filter(b => b.is_mastered && b.mastered_at);
      const beatsNeedingDailyRecall = todayIsNewDay 
        ? masteredBeats
            .filter(b => {
              if (!isShortCycleEligible(b)) return false;
              if (isInCooldown(b)) return false;
              // Skip if already in any recall queue
              if (beatsNeeding10MinRecall.some(r => r.id === b.id)) return false;
              if (beatsNeedingEveningRecall.some(r => r.id === b.id)) return false;
              if (beatsNeedingMorningRecall.some(r => r.id === b.id)) return false;
              // Need recall if: never recalled today
              if (!b.last_recall_at) return true;
              const lastRecall = new Date(b.last_recall_at);
              return lastRecall.toDateString() !== new Date().toDateString();
            })
            .sort((a, b) => {
              const aR = a.last_recall_at ? new Date(a.last_recall_at).getTime() : 0;
              const bR = b.last_recall_at ? new Date(b.last_recall_at).getTime() : 0;
              if (aR !== bR) return aR - bR;
              return a.beat_order - b.beat_order;
            })
        : [];
      
      // Find mastered beats that need scheduled 2/3/5/7 recall (next_scheduled_recall_at is in the past)
      // Note: scheduled-ladder recall IS allowed even for high-session beats — it's
      // exactly how they stay durable. But cooldown still suppresses solo recall.
      const beatsNeedingScheduledRecall = masteredBeats.filter(b => {
        if (!b.next_scheduled_recall_at) return false;
        if (isInCooldown(b)) return false;
        // Skip if already in any other recall queue
        if (beatsNeeding10MinRecall.some(r => r.id === b.id)) return false;
        if (beatsNeedingEveningRecall.some(r => r.id === b.id)) return false;
        if (beatsNeedingMorningRecall.some(r => r.id === b.id)) return false;
        if (beatsNeedingDailyRecall.some(r => r.id === b.id)) return false;
        const scheduledTime = new Date(b.next_scheduled_recall_at);
        if (scheduledTime > now) return false;
        // Check if already recalled after the scheduled time
        if (b.last_recall_at && new Date(b.last_recall_at) >= scheduledTime) return false;
        return true;
      });
      
      // Combine: 10-minute recalls first, then evening, then morning, then scheduled 2/3/5/7, then daily recalls
      const allBeatsNeedingRecall = [
        ...beatsNeeding10MinRecall, 
        ...beatsNeedingEveningRecall, 
        ...beatsNeedingMorningRecall, 
        ...beatsNeedingScheduledRecall,
        ...beatsNeedingDailyRecall,
      ];
      
      // Check if we need a merged recall (2+ mastered beats and any individual recall is due)
      const shouldDoMergedRecall = masteredBeats.length >= 2 && allBeatsNeedingRecall.length > 0;
      // Check if merged recall was already done recently (within last 4 hours)
      const mergedRecallNeeded = shouldDoMergedRecall && masteredBeats.every(b => {
        if (!b.last_merged_recall_at) return true;
        const lastMerged = new Date(b.last_merged_recall_at);
        return (now.getTime() - lastMerged.getTime()) > 4 * 60 * 60 * 1000; // 4 hours
      });
      
      // Find unmastered beats
      const unmasteredBeats = rows.filter(b => !b.is_mastered);
      const unmasteredCount = unmasteredBeats.length;
      
      console.log('📊 Beats loaded:', {
        total: rows.length,
        mastered: masteredBeats.length,
        unmastered: unmasteredCount,
        beatsNeeding10MinRecall: beatsNeeding10MinRecall.length,
        beatsNeedingEveningRecall: beatsNeedingEveningRecall.length,
        beatsNeedingMorningRecall: beatsNeedingMorningRecall.length,
        beatsNeedingScheduledRecall: beatsNeedingScheduledRecall.length,
        beatsNeedingDailyRecall: beatsNeedingDailyRecall.length,
        mergedRecallNeeded,
        firstUnmasteredBeatOrder: unmasteredBeats[0]?.beat_order,
      });
      
      // Calculate how many beats we can learn today based on deadline
      const computedBeatsPerDay = calculateBeatsPerDay(unmasteredCount, computedDaysUntilDeadline);
      setBeatsPerDay(computedBeatsPerDay);
      
      // Count how many beats were already mastered today
      const beatsLearnedToday = rows.filter(b => {
        if (!b.mastered_at) return false;
        const masteredDate = new Date(b.mastered_at);
        return masteredDate.toDateString() === new Date().toDateString();
      }).length;
      
      // Premium users can learn unlimited beats; free users are limited
      const canLearnMore = isPremium || beatsLearnedToday < computedBeatsPerDay;
      const firstUnmastered = canLearnMore ? (unmasteredBeats[0] || null) : null;
      
      console.log('Beat selection:', {
        beatsPerDay: computedBeatsPerDay,
        beatsLearnedToday,
        canLearnMore,
        selectedBeatOrder: firstUnmastered?.beat_order,
      });
      
      setBeatsToRecall(allBeatsNeedingRecall);
      setNewBeatToLearn(firstUnmastered);
      
      // Store merged recall info
      if (mergedRecallNeeded) {
        setMergedRecallBeats(masteredBeats.sort((a, b) => a.beat_order - b.beat_order));
      }
      
      // Track if we're starting with 10-min recalls
      setIs10MinRecall(beatsNeeding10MinRecall.length > 0);
      
      // Determine starting mode - prioritize recalls by type
      if (allBeatsNeedingRecall.length > 0) {
        setSessionMode('recall');
        setRecallIndex(0);
        const recallType = beatsNeeding10MinRecall.length > 0 ? '10-MINUTE RECALL' 
          : beatsNeedingEveningRecall.length > 0 ? 'EVENING RECALL'
          : beatsNeedingMorningRecall.length > 0 ? 'MORNING RECALL'
          : 'daily recall';
        console.log('⏰ Starting recall mode:', recallType);
        initializeRecallMode();
      } else if (firstUnmastered) {
        // Check if there's a saved checkpoint for this beat - resume directly if so
        if (firstUnmastered.checkpoint_phase && firstUnmastered.checkpoint_sentence) {
          console.log('🔄 Restoring checkpoint: sentence', firstUnmastered.checkpoint_sentence, 'phase', firstUnmastered.checkpoint_phase);
          
          setSessionMode('learn');
          setCurrentBeatIndex(rows.findIndex(b => b.id === firstUnmastered.id));
          
          // Restore the phase
          setPhase(firstUnmastered.checkpoint_phase as Phase);
          
          // Restore hidden word indices if available
          if (firstUnmastered.checkpoint_hidden_indices && Array.isArray(firstUnmastered.checkpoint_hidden_indices)) {
            setHiddenWordIndices(new Set(firstUnmastered.checkpoint_hidden_indices));
            setHiddenWordOrder([...firstUnmastered.checkpoint_hidden_indices]);
          }
        } else {
          // No checkpoint - check if we should do pre-beat recall first
          // Find the most recently mastered beat (if any)
          const lastMasteredBeat = masteredBeats
            .filter(b => b.mastered_at)
            .sort((a, b) => new Date(b.mastered_at!).getTime() - new Date(a.mastered_at!).getTime())[0];
          
          if (lastMasteredBeat) {
            // There's a previously mastered beat - recall it once before learning the new beat
            console.log('🔄 Pre-beat recall: recalling beat', lastMasteredBeat.beat_order, 'before learning beat', firstUnmastered.beat_order);
            setBeatToRecallBeforeNext(lastMasteredBeat);
            setNextBeatQueued(firstUnmastered);
            setCurrentBeatIndex(rows.findIndex(b => b.id === lastMasteredBeat.id));
            // Initialize pre-beat recall mode - start with all words visible
            setPreBeatRecallSuccessCount(0);
            setHiddenWordIndices(new Set());
            setHiddenWordOrder([]);
            setProtectedWordIndices(new Set());
            setPhase('beat_fading');
            setSessionMode('pre_beat_recall');
            setShowPreBeatRecallIntro(true);
          } else {
            // First beat ever - go directly to beat preview
            setSessionMode('beat_preview');
            setCurrentBeatIndex(rows.findIndex(b => b.id === firstUnmastered.id));
          }
        }
      } else if (masteredBeats.length > 0) {
        // DAY-BEFORE / DEADLINE-DAY FULL REHEARSAL:
        // When the presentation is ≤1 day away and all beats are mastered,
        // always run the merged full-speech recall instead of single-beat maintenance.
        // This guarantees at least one true end-to-end run-through before showtime.
        if (masteredBeats.length >= 2 && computedDaysUntilDeadline <= 1) {
          console.log('🎤 Deadline ≤1 day — forcing full-speech merged rehearsal');
          const mergedBeat: Beat = {
            id: 'merged-recall',
            beat_order: -1,
            sentence_1_text: masteredBeats.map(b => b.sentence_1_text).join(' '),
            sentence_2_text: masteredBeats.map(b => b.sentence_2_text).join(' '),
            sentence_3_text: masteredBeats.map(b => b.sentence_3_text).join(' '),
            is_mastered: true,
            mastered_at: null,
            last_recall_at: null,
            recall_10min_at: null,
            recall_evening_at: null,
            recall_morning_at: null,
          };
          setMergedRecallBeats(masteredBeats.sort((a, b) => a.beat_order - b.beat_order));
          setIsMergedRecall(true);
          setBeatsToRecall([mergedBeat]);
          setSessionMode('recall');
          setRecallIndex(0);
          initializeRecallMode();
          return;
        }

        // All beats completed - rotate through beats by least-recently practiced
        // Pick the beat that's been practiced the longest time ago (or never recalled)
        // Tie-break by lowest recall_session_number, then by beat_order.
        const sortedForMaintenance = [...masteredBeats].sort((a, b) => {
          const aRecall = a.last_recall_at ? new Date(a.last_recall_at).getTime() : 0;
          const bRecall = b.last_recall_at ? new Date(b.last_recall_at).getTime() : 0;
          if (aRecall !== bRecall) return aRecall - bRecall; // oldest first
          const aSess = a.recall_session_number ?? 0;
          const bSess = b.recall_session_number ?? 0;
          if (aSess !== bSess) return aSess - bSess; // least-reviewed first
          return a.beat_order - b.beat_order;
        });
        const beatToRecall = sortedForMaintenance[0];
        console.log('🔄 All beats completed - maintenance recall on beat', beatToRecall.beat_order, '(last recalled:', beatToRecall.last_recall_at ?? 'never', ')');
        setBeatsToRecall([beatToRecall]);
        setSessionMode('recall');
        setRecallIndex(0);
        setCurrentBeatIndex(rows.findIndex(b => b.id === beatToRecall.id));
        initializeRecallMode();
      } else {
        // No beats at all
        setSessionMode('session_complete');
      }
    };

    const looksMisSegmented = (s: string) => {
      const text = (s ?? '').trim();
      if (!text) return true;
      if (text.includes('\n')) return true;
      const wordsCount = text.split(/\s+/).filter(Boolean).length;
      if (wordsCount > 28) return true;
      const punctCount = (text.match(/[.!?]/g) ?? []).length;
      if (punctCount > 1) return true;
      return false;
    };

    // Try to load existing beats
    const { data: existingBeats, error } = await supabase
      .from('practice_beats')
      .select('*')
      .eq('speech_id', speechId)
      .order('beat_order', { ascending: true });

    if (error) {
      console.error('Error loading beats:', error);
    }

    // Check if any beat is mastered - never regenerate if so (would lose progress!)
    const hasMasteredBeats = existingBeats?.some(b => b.is_mastered);
    
    const shouldRegenerate =
      !hasMasteredBeats && // Never regenerate if any beat is mastered
      !!existingBeats &&
      existingBeats.length > 0 &&
      existingBeats.some(
        (b) =>
          looksMisSegmented(b.sentence_1_text) ||
          looksMisSegmented(b.sentence_2_text) ||
          looksMisSegmented(b.sentence_3_text)
      );

    if (existingBeats && existingBeats.length > 0 && !shouldRegenerate) {
      setBeatsAndPlan(existingBeats as Beat[]);
      setLoading(false);
      return;
    }
    
    // Also don't regenerate if mastered beats exist
    if (hasMasteredBeats) {
      console.log('⚠️ Skipping regeneration - mastered beats exist');
      setBeatsAndPlan(existingBeats as Beat[]);
      setLoading(false);
      return;
    }

    // Create/regenerate beats using backend function
    try {
      const { data, error: fnError } = await supabase.functions.invoke('segment-speech-into-beats', {
        body: { speechId },
      });

      if (fnError) throw fnError;

      if (data?.beats) {
        setBeatsAndPlan(data.beats as Beat[]);
      } else if (existingBeats && existingBeats.length > 0) {
        setBeatsAndPlan(existingBeats as Beat[]);
      }
    } catch (error) {
      console.error('Error creating beats:', error);
      if (existingBeats && existingBeats.length > 0) {
        setBeatsAndPlan(existingBeats as Beat[]);
      }
    }

    // NOTE: Don't update last_practice_session_at here on load
    // It should only be updated when a beat is actually completed/mastered
    // This prevents the lock from triggering when user just opens and exits

    setLoading(false);
  };

  // Initialize recall mode - start fully visible, then fade 2-3 words per successful rep
  const initializeRecallMode = () => {
    // Start fully visible for recall (words fade as user succeeds)
    setPhase('beat_fading'); // Use beat_fading phase for recall
    setRepetitionCount(1);
    repetitionCountRef.current = 1;
    setConsecutiveNoScriptSuccess(0);
    setRecallSuccessCount(0);
    // Start with all words VISIBLE (empty hidden set)
    setHiddenWordIndices(new Set());
    setHiddenWordOrder([]);
  };

  // Progressive words to hide: 3 → 4 → 5 (minimum 3, increases with streak)
  const getWordsToHideCount = useCallback((successCount: number): number => {
    // Always hide minimum 3 words, then 4, then 5 (max) with success streak
    // 0 successes = 3 words, 1 success = 4 words, 2+ successes = 5 words
    return Math.min(3 + successCount, 5);
  }, []);

  // Effect to reset hidden words when changing recall beat
  // Gap words (COMMON_WORDS) are always pre-hidden from the start
  useEffect(() => {
    if (sessionMode === 'recall' && words.length > 0) {
      const preHidden = new Set<number>();
      const preHiddenOrder: number[] = [];
      words.forEach((w, i) => {
        const clean = w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
        if (COMMON_WORDS.has(clean)) {
          preHidden.add(i);
          preHiddenOrder.push(i);
        }
      });
      setHiddenWordIndices(preHidden);
      setHiddenWordOrder(preHiddenOrder);
    }
  }, [sessionMode, recallIndex, words]);

  // Determine which word to hide next (priority order)
  // Protected words (failed/hesitated) are hidden LAST
  const getNextWordToHide = useCallback((currentHidden: Set<number>, protectedSet?: Set<number>): number | null => {
    const protected_ = protectedSet ?? protectedWordIndices;
    
    // First pass: only consider non-protected visible words
    const nonProtectedVisible = words
      .map((_, i) => i)
      .filter(i => !currentHidden.has(i) && !protected_.has(i));

    // Identify sentence-start indices — these are fragile to hide because the
    // first word of a sentence is the most error-prone for speech recognition.
    const isSentenceStart = (i: number) =>
      i === 0 || /[.!?]$/.test(words[i - 1] ?? '');
    const nonSentenceStart = nonProtectedVisible.filter(i => !isSentenceStart(i));

    // If there are non-protected words to hide, use those first
    if (nonProtectedVisible.length > 0) {
      // Priority 1: Common articles/prepositions (skip sentence-starts when possible)
      for (const idx of nonSentenceStart) {
        const word = words[idx].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
        if (COMMON_WORDS.has(word)) return idx;
      }

      // Priority 2: Short words (2-4 chars), still avoiding sentence-starts
      for (const idx of nonSentenceStart) {
        const word = words[idx].normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
        if (word.length >= 2 && word.length <= 4) return idx;
      }

      // Priority 3: Middle words (not first or last)
      const middleIndices = nonSentenceStart.filter(i => i > 0 && i < words.length - 1);
      if (middleIndices.length > 0) return middleIndices[0];

      // Priority 4: Any non-sentence-start word
      if (nonSentenceStart.length > 0) return nonSentenceStart[0];

      // Priority 5: Fallback — only sentence-starts left, hide them last
      return nonProtectedVisible[0];
    }
    
    // Second pass: all non-protected words are hidden, now hide protected words
    const protectedVisible = words
      .map((_, i) => i)
      .filter(i => !currentHidden.has(i) && protected_.has(i));
    
    if (protectedVisible.length === 0) return null;
    
    // For protected words, hide in order they appear (first to last)
    return protectedVisible[0];
  }, [words, protectedWordIndices]);

  // Normalize word for comparison (language-agnostic)
  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  };

  const isGapWord = (word: string): boolean => COMMON_WORDS.has(normalizeWord(word));

  const isEffectivelyLenientWord = (index: number): boolean => {
    const isHidden = hiddenWordIndicesRef.current.has(index);
    if (!isHidden) return false;

    return (
      lenientWordIndicesRef.current.has(index) ||
      isGapWord(words[index] ?? '')
    );
  };

  const getWordDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    const curr = Array.from({ length: b.length + 1 }, () => 0);

    for (let i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(
          curr[j - 1] + 1,
          prev[j] + 1,
          prev[j - 1] + cost
        );
      }
      for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
    }

    return prev[b.length];
  };

  // Check if spoken word matches expected - STRICT matching
  // More lenient matching for visible words and lenient words (proper nouns), stricter for regular hidden words
  const wordsMatch = (spoken: string, expected: string, isHidden: boolean = false, isLenient: boolean = false): boolean => {
    // FLOW mode should be a little more forgiving, but not “name-level” lenient.
    // Treating every hidden word as lenient allowed weak first-letter matches to
    // cascade through whole sentences/sessions.
    const isFlowRelaxedHidden = practiceStrictness === 'flow' && isHidden && !isLenient;
    const s = normalizeWord(spoken);
    const e = normalizeWord(expected);
    
    // Auto-accept hard-to-recognize words (numbers, year ranges, abbreviations)
    // but only if user actually said something (non-empty spoken word)
    if (s.length > 0 && isHardToRecognizeWord(expected)) {
      console.log(`🔢 Auto-accepting hard-to-recognize word: "${expected}" (heard: "${s}")`);
      return true;
    }
    
    // Debug logging for troubleshooting
    if (isHidden && !isLenient) {
      console.log(`🎯 Hidden word match: spoken="${s}" expected="${e}" exact=${s === e}`);
    }
    
    // Exact match - always pass
    if (s === e) return true;
    
    // Empty after normalization
    if (!s || !e) return false;
    
    // For LENIENT words (proper nouns/names, flow mode, and short gap words), use forgiving rules.
    // These are hidden but should not block the user when speech recognition drops or merges them.
    if (isLenient) {
      // VERY lenient matching for names/proper nouns - speech recognition often 
      // produces completely different text for names like "Ebba Hallert Djurberg"
      if (e.length <= 2) {
        if (s === e) return true;
        if (s.length > e.length && s.includes(e)) return true;
        return s.length === e.length && s[0] === e[0];
      }
      
      // Accept if first letter matches - names often get partially right
      if (s.length >= 2 && e.length >= 2 && s[0] === e[0]) return true;
      
      // Accept if first 2 chars of either match the other
      if (s.length >= 2 && e.length >= 2) {
        if (s.startsWith(e.slice(0, 2)) || e.startsWith(s.slice(0, 2))) return true;
      }
      
      // Allow very high length variance for names (up to 60%)
      const lenRatio = Math.min(s.length, e.length) / Math.max(s.length, e.length);
      if (lenRatio < 0.3) return false;
      
      // Count matching characters (not position-dependent)
      const sChars = s.split('');
      const eChars = e.split('');
      let matches = 0;
      const eCopy = [...eChars];
      for (const c of sChars) {
        const idx = eCopy.indexOf(c);
        if (idx !== -1) {
          matches++;
          eCopy.splice(idx, 1);
        }
      }
      
      // Need only 35% character overlap for names (very lenient)
      const overlapRatio = matches / Math.max(s.length, e.length);
      return overlapRatio >= 0.35;
    }
    
    // For HIDDEN words (non-lenient), be moderately strict — must prove they know it,
    // but don't punish normal speech-recognition variance (vowel slips, missing endings).
    if (isHidden) {
      // 1-char words require exact match
      if (e.length <= 1) return s === e;

      // Substring containment: spoken merged with neighbor (e.g. "the era" -> "thera")
      if (s.length >= e.length && s.includes(e)) return true;
      if (e.length >= 4 && e.includes(s) && s.length >= e.length - 2) return true;

      const lengthVariance = Math.abs(s.length - e.length);
      const maxLengthVariance = isFlowRelaxedHidden
        ? Math.max(2, Math.ceil(e.length * 0.45))
        : Math.max(2, Math.ceil(e.length * 0.35));
      if (lengthVariance > maxLengthVariance) return false;

      const sameFirstSound = s[0] === e[0];
      const sameSecondSound = s.length > 1 && e.length > 1 && s[1] === e[1];
      const baseMaxDist = e.length <= 2 ? 1 : e.length <= 5 ? 2 : Math.ceil(e.length * 0.34);
      const maxDist = isFlowRelaxedHidden ? baseMaxDist + 1 : baseMaxDist;
      const dist = getWordDistance(s, e);

      if (sameFirstSound && dist <= maxDist) return true;
      if (sameSecondSound && e.length >= 4 && dist <= maxDist) return true;
      return e.length >= 6 && dist <= 2;
    }
    
    // For VISIBLE words, slightly more lenient than hidden but still meaningful
    // Short words (1-2 chars): require exact, OR accept if spoken contains expected as substring
    // (handles speech recognition merging short words into neighbors, e.g. "the era" → "thera")
    if (e.length <= 2) {
      if (s === e) return true;
      // Allow merged-word recovery: if expected is contained in spoken
      if (s.length >= e.length && s.includes(e)) return true;
      return false;
    }
    
    // 3-char words: allow 1 difference, OR substring containment for merged-word cases
    if (e.length === 3) {
      // Substring containment (e.g. "era" inside "thera" or "eraof")
      if (s.length > e.length && s.includes(e)) return true;
      if (Math.abs(s.length - e.length) > 1) return false;
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
      }
      return diff <= 1;
    }
    
    // 4+ char words: use Levenshtein with slightly more tolerance than hidden
    // Substring containment also works here for merged words
    if (s.length > e.length + 2 && s.includes(e)) return true;
    
    // Don't match if lengths are too different
    if (Math.abs(s.length - e.length) > 2) return false;
    
    // Must share first letter (same starting sound)
    if (s[0] !== e[0]) return false;
    
    // Allow 1 edit for 4-6 letter words, 2 for 7-10, 3 for 11+
    const maxDist = e.length <= 6 ? 1 : e.length <= 10 ? 2 : 3;
    return getWordDistance(s, e) <= maxDist;
  };

  // Process transcription - cursor-based
  const processTranscription = useCallback((transcript: string, isFinal: boolean, repId: number, phaseEpoch?: number) => {
    if (repId !== repetitionIdRef.current) return;
    if (phaseEpoch !== undefined && phaseEpoch !== phaseEpochRef.current) return;
    
    const rawWords = transcript.split(/\s+/).filter((w) => w.trim());
    if (rawWords.length === 0) return;

    // Immediately after a reset the Web/Native recognizers can replay a chunk
    // from the previous rep. Never let a bulk replay from an empty local buffer
    // drive the cursor through the new sentence.
    if (
      transcriptWordsRef.current.length === 0 &&
      currentWordIndexRef.current === 0 &&
      rawWords.length > 2 &&
      Date.now() < staleReplayGuardUntilRef.current
    ) {
      hasHeardSpeechRef.current = false;
      return;
    }

    // Any non-empty recognition event means the user is actively speaking.
    // Do this before tail-deduping so repeated interim results don't let the
    // hesitation timer mark hidden words yellow while the microphone is hearing them.
    hasHeardSpeechRef.current = true;
    // IMPORTANT: do NOT reset lastWordTimeRef on every interim result. If the
    // recognizer keeps emitting fragments that never match the expected hidden
    // word (e.g. "har"/"harmod"/"fahar" while we expect "man"), resetting the
    // clock here prevents the 2s hesitation auto-advance from ever firing and
    // the cursor freezes. lastWordTimeRef is reset on real matches (line ~1813)
    // and on sentence boundaries / phase transitions, which is sufficient.

    // Voice command: "börja om" / "start over" / "starta om" / "von vorn(e)" / "recommencer" /
    // "empezar de nuevo" / "ricomincia" / "começar de novo". Detect on the LAST few raw tokens
    // so we don't accidentally trigger on script content earlier in the transcript.
    {
      const tail = rawWords.slice(-4).join(' ').toLowerCase().replace(/[.,!?]/g, '');
      const RESTART_PHRASES = [
        'börja om', 'starta om', 'börja från början', 'om från början',
        'start over', 'restart', 'from the top', 'start again',
        'von vorn', 'von vorne', 'noch mal', 'nochmal',
        'recommencer', 'on recommence', 'reprendre',
        'empezar de nuevo', 'desde el principio', 'otra vez',
        'ricomincia', 'da capo',
        'começar de novo', 'recomeçar', 'do início',
      ];
      if (RESTART_PHRASES.some((p) => tail.includes(p))) {
        if (Date.now() >= restartCooldownUntilRef.current) {
          restartCurrentBeatRef.current?.('voice');
        }
        return;
      }
    }

    const currentIdx = currentWordIndexRef.current;

    if (currentIdx >= words.length) {
      return;
    }

    // Speech recognition often *updates* the last word (same word count) as it becomes final.
    // If we only process appended words, we can get stuck (especially on the final word).
    const prevWords = transcriptWordsRef.current;
    const prevCount = prevWords.length;

    let startIdx: number;

    if (rawWords.length > prevCount) {
      // New words appended
      startIdx = prevCount;
    } else {
      // No new words appended; only reprocess if the tail changed (last 1-2 words)
      const tailCheck = Math.min(2, rawWords.length, prevCount);
      let tailChanged = prevCount === 0; // if we had none before, treat as changed

      for (let i = 1; i <= tailCheck; i++) {
        if (normalizeWord(rawWords[rawWords.length - i]) !== normalizeWord(prevWords[prevCount - i])) {
          tailChanged = true;
          break;
        }
      }

      if (tailChanged) {
        // Reprocess the last couple of words to pick up corrections
        startIdx = Math.max(0, rawWords.length - 2);
      } else {
        return;
      }
    }

    transcriptRef.current = transcript;

    const newWords = rawWords.slice(startIdx);

    // If no words to process, nothing to do
    if (newWords.length === 0) return;

    const rawTokenAt = (absoluteIndex: number): string => rawWords[absoluteIndex] ?? '';
    const tokenVariantsAt = (absoluteIndex: number): string[] => {
      const variants = [rawTokenAt(absoluteIndex)];
      const current = rawTokenAt(absoluteIndex);
      const next = rawTokenAt(absoluteIndex + 1);
      const previous = rawTokenAt(absoluteIndex - 1);

      if (current && next) variants.push(`${current}${next}`, `${current} ${next}`);
      if (previous && current) variants.push(`${previous}${current}`, `${previous} ${current}`);

      return [...new Set(variants.filter(Boolean))];
    };

    const wordMatchesAnyVariant = (absoluteIndex: number, expectedIndex: number) => {
      const expectedIsHidden = hiddenWordIndicesRef.current.has(expectedIndex);
      const expectedIsLenient = isEffectivelyLenientWord(expectedIndex);
      return tokenVariantsAt(absoluteIndex).some((variant) =>
        wordsMatch(variant, words[expectedIndex], expectedIsHidden, expectedIsLenient)
      );
    };

    let advancedTo = currentIdx;
    const newSpoken = new Set(spokenIndicesRef.current);
    const newMissed = new Set(missedIndicesRef.current);
    let lastMatchedRawIndex = startIdx - 1;
    let matchedFreshSpeech = false;

    for (let rawOffset = 0; rawOffset < newWords.length; rawOffset++) {
      const absoluteRawIndex = startIdx + rawOffset;
      if (advancedTo >= words.length) break;
      // If we've landed on a pause token, stop matching and let the
      // pause-trigger effect handle the countdown + auto-advance.
      if (pauseWordMeta.has(advancedTo)) break;

      // Check if current word is hidden (needs stricter matching) and if it's lenient (proper noun/name/gap word/flow)
      const currentIsHidden = hiddenWordIndicesRef.current.has(advancedTo);
      const currentIsLenient = isEffectivelyLenientWord(advancedTo);
      const currentIsSentenceStart = advancedTo === 0 || /[.!?]$/.test(words[advancedTo - 1] ?? '');
      // True if advancing past `advancedTo` would cross into a new sentence
      const crossesSentenceBoundary = (from: number, to: number) => {
        for (let k = from; k < to; k++) {
          if (/[.!?]$/.test(words[k] ?? '')) return true;
        }
        return false;
      };

      // STRICT: Only match the CURRENT word position - no lookahead
      // This prevents jumping to a duplicate word further in the sentence
      let foundIdx = -1;
      if (wordMatchesAnyVariant(absoluteRawIndex, advancedTo)) {
        foundIdx = advancedTo;
      }

      if (foundIdx === -1) {
        // Current word didn't match - check NEXT word (lookahead of 1)
        // STRICT RULE: lookahead may ONLY skip over visible (non-hidden) words,
        // EXCEPT hidden gap words (att, och, i, på, som, en, ett, det, ...).
        // Gap words are interchangeable filler — if the user substitutes or
        // omits one when the whole sentence is hidden, that should not freeze
        // the cursor or count against them.
        const isHiddenGap = (i: number) =>
          hiddenWordIndicesRef.current.has(i) && isGapWord(words[i] ?? '');
        const canSkipWord = (i: number) =>
          !hiddenWordIndicesRef.current.has(i) || isHiddenGap(i);
        const canSkipCurrent = canSkipWord(advancedTo);
        if (
          canSkipCurrent &&
          advancedTo + 1 < words.length &&
          canSkipWord(advancedTo + 1) === false ? false : true
        ) { /* no-op guard, real checks below */ }
        if (
          canSkipCurrent &&
          advancedTo + 1 < words.length &&
          !crossesSentenceBoundary(advancedTo, advancedTo + 1) &&
          wordMatchesAnyVariant(absoluteRawIndex, advancedTo + 1)
        ) {
          newSpoken.add(advancedTo);
          foundIdx = advancedTo + 1;
        } else if (canSkipCurrent && advancedTo + 2 < words.length) {
          // 2-word lookahead — visible words or hidden gap words only,
          // never crossing a sentence boundary.
          if (
            canSkipWord(advancedTo + 1) &&
            !crossesSentenceBoundary(advancedTo, advancedTo + 2) &&
            wordMatchesAnyVariant(absoluteRawIndex, advancedTo + 2)
          ) {
            newSpoken.add(advancedTo);
            newSpoken.add(advancedTo + 1);
            foundIdx = advancedTo + 2;
          }
        }
      }


      if (foundIdx === -1) {
        // No match for this spoken token. Do NOT auto-advance hidden words —
        // that caused the cursor to jump over hidden words on background speech.
        // Hidden words advance only on a real match, the controlled lookahead above,
        // or the hesitation timeout in the recording loop.
        continue;
      }

      // Found a match at current position or nearby - mark all words up to match as spoken
      // If we're jumping ahead (foundIdx > advancedTo), mark skipped hidden words as missed
      // BUT: lenient words (proper nouns/names) can't turn red - they just move on
      for (let j = advancedTo; j < foundIdx; j++) {
        const isHidden = hiddenWordIndicesRef.current.has(j);
        const isLenient = isEffectivelyLenientWord(j);
        if (isHidden && !isLenient) {
          newMissed.add(j);
        }
        newSpoken.add(j);
      }
      newSpoken.add(foundIdx);
      postPauseNoHesitationIndicesRef.current.delete(foundIdx);
      
      // IMPORTANT: If this exact word was previously marked as missed (red), remove it
      // This prevents the flash of red when speech recognition initially mishears
      if (newMissed.has(foundIdx)) {
        newMissed.delete(foundIdx);
      }
      
      // Update missed state if changed
      if (missedIndicesRef.current.size !== newMissed.size) {
        missedIndicesRef.current = newMissed;
        setMissedIndices(newMissed);
      }

      advancedTo = foundIdx + 1;
      lastMatchedRawIndex = startIdx + rawOffset;
      if (
        rawWords.length > prevCount &&
        Date.now() - phaseTransitionAtRef.current > 500
      ) {
        matchedFreshSpeech = true;
      }
      lastWordTimeRef.current = Date.now();

      // HARD sentence-boundary stop: if we just matched the final word of a
      // sentence, do NOT keep consuming buffered transcript tokens into the
      // next sentence within the same processing pass. The next sentence
      // must wait for fresh recognition input. This prevents cascading skips
      // where leftover interim text races through one or more sentences.
      if (/[.!?]$/.test(words[foundIdx] ?? '')) {
        hasHeardSpeechRef.current = false;
        lastWordTimeRef.current = Date.now();
        break;
      }
    }

    if (missedIndicesRef.current.size !== newMissed.size) {
      missedIndicesRef.current = newMissed;
      setMissedIndices(newMissed);
    }

    // Only consume transcript words up to the last word that actually advanced the cursor.
    // Hidden words are often corrected by interim speech recognition after a short delay;
    // consuming failed attempts immediately made the app ignore the later correct version.
    transcriptWordsRef.current = rawWords.slice(0, Math.max(0, lastMatchedRawIndex + 1));

    if (advancedTo >= words.length) {
      if (phase.includes('learning') && needsFreshSpeechRef.current && !matchedFreshSpeech) {
        console.log('🛑 Completion blocked — stale transcript reached sentence end');
        return;
      }

      if (matchedFreshSpeech) {
        needsFreshSpeechRef.current = false;
      }

      if (lastCompletionRepIdRef.current === repId) {
        return;
      }

      lastCompletionRepIdRef.current = repId;

      const failedFromSignals = new Set<number>();
      hiddenWordIndicesRef.current.forEach((idx) => {
        if (hesitatedIndicesRef.current.has(idx) || missedIndicesRef.current.has(idx)) {
          failedFromSignals.add(idx);
        }
      });

      checkCompletion(newSpoken, failedFromSignals);
      return;
    }

    if (advancedTo > currentIdx) {
      if (matchedFreshSpeech) {
        needsFreshSpeechRef.current = false;
      }

      currentWordIndexRef.current = advancedTo;
      setCurrentWordIndex(advancedTo);

      spokenIndicesRef.current = newSpoken;
      setSpokenIndices(newSpoken);
    }

  }, [words, wordsMatch, normalizeWord]);

  useEffect(() => {
    processTranscriptionRef.current = processTranscription;
  }, [processTranscription]);

  // Check if current phase is complete
  function checkCompletion(spoken: Set<number>, failed?: Set<number>) {
    const allSpoken = words.every((_, i) => spoken.has(i));

    if (!allSpoken) return;

    const failedSet = failed ?? failedWordIndices;
    const hadErrors = failedSet.size > 0;

    // Handle recall mode completion (morning recall of mastered beats)
    if (sessionMode === 'recall') {
      handleRecallCompletion(hadErrors);
      return;
    }
    
    // Handle pre-beat recall mode completion (recall previous beat before learning new)
    if (sessionMode === 'pre_beat_recall') {
      handlePreBeatRecallCompletion(hadErrors);
      return;
    }

    if (phase.includes('learning')) {
      const currentPhase = phase;
      const currentRep = repetitionCountRef.current;

      // Hard gate: in a learning phase we must have heard genuinely new speech
      // since the last phase transition. This blocks stale buffered transcripts
      // from auto-completing (and skipping) a sentence the user hasn't said yet.
      if (needsFreshSpeechRef.current) {
        console.log('🛑 Completion blocked — no fresh speech since phase transition');
        return;
      }

      // Use familiarity-based required reps (2 for confident, 3 for others)
      if (currentRep >= requiredLearningReps) {
        pauseSpeechRecognition(1700);
        resetForNextRep();
        setCelebrationMessage(t('beat_practice.great_start_fading'));

        setTimeout(() => {
          setShowCelebration(true);

          setTimeout(() => {
            setShowCelebration(false);
            let nextPhase: Phase;
            if (currentPhase === 'sentence_1_learning') nextPhase = 'sentence_1_fading';
            else if (currentPhase === 'sentence_2_learning') nextPhase = 'sentence_2_fading';
            else if (currentPhase === 'sentences_1_2_learning') nextPhase = 'sentences_1_2_fading';
            else if (currentPhase === 'sentence_3_learning') nextPhase = 'sentence_3_fading';
            else if (currentPhase === 'beat_learning') nextPhase = 'beat_fading';
            else nextPhase = currentPhase.replace('learning', 'fading') as Phase;

            transitionToPhase(nextPhase);
          }, 1500);
        }, 150);
      } else {
        repetitionCountRef.current = currentRep + 1;
        pauseSpeechRecognition(900);
        setCelebrationMessage(`${currentRep}/${requiredLearningReps}`);
        setShowCelebration(true);

        setTimeout(() => {
          setShowCelebration(false);
          setRepetitionCount(repetitionCountRef.current);
          resetForNextRep();
        }, 800);
      }
    } else if (phase.includes('fading') || phase.includes('combining')) {
      pauseSpeechRecognition(750);
      handleFadingCompletion(hadErrors, failedSet);
    }
  }

  // Handle recall mode completion - progressive fading approach
  function handleRecallCompletion(hadErrors: boolean) {
    pauseSpeechRecognition(1200);

    const allHidden = hiddenWordIndices.size >= words.length;

    if (hadErrors) {
      // Failed recall: reveal missed/hesitated words and retry the same visibility.
      // Never hide new words after an errored round — otherwise the system can
      // progress even though the user has not completed the repetition.
      setRecallSuccessCount(0);

      // FAILURE SEVERITY WEIGHTING:
      //   • full blank      (>50% missed)  → demote 2 rungs, 1-day cooldown candidate
      //   • stumble         (20–50%)       → demote 1 rung
      //   • tiny hesitation (<20%)         → no demotion, just retry
      // Plus FAILURE CLUSTERING: 2 fails within 48h → cooldown for 24h (still merged-eligible).
      const failedBeat = beatsToRecall[recallIndex];
      if (failedBeat && !isMergedRecall) {
        // Union (not sum) — a word that both hesitated AND was later missed
        // must count once, not twice. Summing inflated failRatio and caused
        // unwarranted 2-rung demotions.
        const failedUnion = new Set<number>([
          ...hesitatedIndicesRef.current,
          ...missedIndicesRef.current,
        ]);
        const totalFailed = failedUnion.size;
        const failRatio = words.length > 0 ? totalFailed / words.length : 0;

        let demotionRungs = 0;
        if (failRatio > 0.5) demotionRungs = 2;
        else if (failRatio > 0.2) demotionRungs = 1;
        else demotionRungs = 0;

        const currentSession = failedBeat.recall_session_number ?? 0;
        const demotedSession = Math.max(0, currentSession - demotionRungs);

        // Failure clustering — count fails in last 48h
        const now = new Date();
        const lastFail = failedBeat.last_failure_at ? new Date(failedBeat.last_failure_at) : null;
        const within48h = lastFail && (now.getTime() - lastFail.getTime()) < 48 * 60 * 60 * 1000;
        const newFailCount = within48h ? (failedBeat.recent_failure_count ?? 0) + 1 : 1;

        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(8, 0, 0, 0);

        const updateData: Record<string, any> = {
          last_recall_at: now.toISOString(),
          last_failure_at: now.toISOString(),
          recent_failure_count: newFailCount,
        };

        if (demotionRungs > 0 && currentSession > 0) {
          updateData.recall_session_number = demotedSession;
          updateData.next_scheduled_recall_at = tomorrow.toISOString();
        }

        // Cooldown trigger: 2+ failures within 48h
        if (newFailCount >= 2) {
          const cooldownEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          updateData.cooldown_until = cooldownEnd.toISOString();
          console.log(`🧊 Beat ${failedBeat.beat_order} entered 24h cooldown (${newFailCount} fails in 48h)`);
        }

        supabase
          .from('practice_beats')
          .update(updateData)
          .eq('id', failedBeat.id)
          .then(() => {
            console.log(`⬇️ Beat ${failedBeat.beat_order} fail (${Math.round(failRatio*100)}%) → demote ${demotionRungs} → session ${demotedSession}`);
          });

        // FSRS scheduler — only kicks in once the beat has graduated past the
        // short-cycle (10-min / evening / morning) ladder. Otherwise FSRS's
        // multi-day initial intervals pre-empt the early consolidation reps
        // that Ebbinghaus / Pimsleur research depend on.
        if ((failedBeat.recall_session_number ?? 0) >= 2) {
          const visibleCount = Math.max(0, words.length - hiddenWordIndicesRef.current.size);
          scheduleNextReview({
            beatId: failedBeat.id,
            eventType: 'recall',
            rawAccuracy: Math.round((1 - failRatio) * 100),
            visibilityPercent: words.length > 0 ? Math.round((visibleCount / words.length) * 100) : 100,
            hesitations: hesitatedIndicesRef.current.size,
            lapses: missedIndicesRef.current.size,
            missedWordCount: missedIndicesRef.current.size,
          });
        }
      }
      
      // Get the specific word indices that failed (hesitated or missed)
      const failedIndices = new Set<number>();
      hesitatedIndicesRef.current.forEach(idx => failedIndices.add(idx));
      missedIndicesRef.current.forEach(idx => failedIndices.add(idx));
      
      // Reveal only the failed words
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      if (failedIndices.size > 0) {
        failedIndices.forEach(idx => newHidden.delete(idx));
        newOrder = newOrder.filter(idx => !failedIndices.has(idx));
      }
      
      setCelebrationMessage(t('common.try_again', 'Try again'));
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        resetForNextRep();
      }, 1200);
    } else if (!allHidden) {
      // Success - hide progressively more words: 3 → 4 → 5
      const wordsToHide = getWordsToHideCount(recallSuccessCount);
      const newSuccessCount = recallSuccessCount + 1;
      setRecallSuccessCount(newSuccessCount);
      
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      for (let i = 0; i < wordsToHide; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        } else {
          break;
        }
      }
      
      const visibleCount = words.length - newHidden.size;
      setCelebrationMessage(`${visibleCount} words left`);
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        resetForNextRep();
      }, 800);
    } else {
      // All hidden and success! Count towards 2 perfect recalls
      const newCount = recallSuccessCount + 1;
      
      if (newCount >= 2) {
        // Successfully recalled this beat twice with all hidden! Update last_recall_at + 2/3/5/7 schedule
        const recalledBeat = beatsToRecall[recallIndex];
        if (recalledBeat && !isMergedRecall) {
          const currentSessionNum = recalledBeat.recall_session_number ?? 0;
          // GRADUATION GATE: cap at session 4 (3-day rung) until the beat has
          // succeeded inside a full-speech / merged rehearsal at least once.
          // This prevents 7-day gaps on beats that were never tested in context.
          const wantsToClimb = currentSessionNum + 1;
          const isCappedByGraduation = wantsToClimb >= 4 && !recalledBeat.passed_in_full_speech;
          const newSessionNum = isCappedByGraduation ? Math.min(wantsToClimb, 3) : wantsToClimb;
          const nextRecallDate = calculateNextRecallDate(newSessionNum, new Date(), goalDate, preferredPracticeHours, fallbackPracticeHour);

          // SCHEDULING OWNERSHIP:
          //   • Sessions 0–1: the ladder (calculateNextRecallDate) owns
          //     next_scheduled_recall_at — the short 10-min/evening/morning
          //     cycle must run untouched (Pimsleur graduated interval recall).
          //   • Sessions 2+: FSRS becomes the single source of truth and the
          //     ladder no longer writes next_scheduled_recall_at to avoid the
          //     race where both fire and the slower call wins arbitrarily.
          const useFsrs = newSessionNum >= 2;

          const updateData: Record<string, any> = {
            last_recall_at: new Date().toISOString(),
            recall_session_number: newSessionNum,
            recent_failure_count: 0, // success resets failure clustering
            cooldown_until: null,
            total_successful_recalls: (recalledBeat.total_successful_recalls ?? 0) + 1,
          };
          if (!useFsrs && nextRecallDate) {
            updateData.next_scheduled_recall_at = nextRecallDate.toISOString();
          }

          supabase
            .from('practice_beats')
            .update(updateData)
            .eq('id', recalledBeat.id)
            .then(() => {
              console.log(`📅 Beat ${recalledBeat.beat_order} → session ${newSessionNum}${isCappedByGraduation ? ' (capped: needs full-speech pass)' : ''}, ${useFsrs ? 'FSRS will schedule' : `next: ${nextRecallDate?.toISOString() ?? 'none'}`}`);
            });

          if (useFsrs) {
            // FSRS scheduler — single source of truth for next_scheduled_recall_at
            // once the beat has cleared the short-cycle ladder.
            const visibleCount = Math.max(0, words.length - hiddenWordIndicesRef.current.size);
            scheduleNextReview({
              beatId: recalledBeat.id,
              eventType: 'recall',
              rawAccuracy: 100,
              visibilityPercent: words.length > 0 ? Math.round((visibleCount / words.length) * 100) : 0,
              hesitations: 0,
              lapses: 0,
              missedWordCount: 0,
            });
          }
        }

        // If this was a merged recall, update last_merged_recall_at AND mark all
        // included beats as having passed in full-speech context (graduation).
        if (isMergedRecall && mergedRecallBeats.length > 0) {
          const now = new Date().toISOString();
          for (const mb of mergedRecallBeats) {
            supabase
              .from('practice_beats')
              .update({
                last_merged_recall_at: now,
                passed_in_full_speech: true,
                total_successful_recalls: (mb.total_successful_recalls ?? 0) + 1,
                recent_failure_count: 0,
                cooldown_until: null,
              })
              .eq('id', mb.id)
              .then(() => {});
          }
          console.log(`🔗 Merged recall → ${mergedRecallBeats.length} beats graduated for full-speech pass`);
        }

        setCelebrationMessage(isMergedRecall ? "Full recall complete!" : "Beat recalled!");
        setShowCelebration(true);

        setTimeout(() => {
          setShowCelebration(false);
          
          // End-of-session recall complete — go to session_complete
          if (isEndOfSessionRecall) {
            console.log('✅ End-of-session 10-min recall complete — session done');
            setIsEndOfSessionRecall(false);
            setIs10MinRecall(false);
            setSessionMode('session_complete');
            return;
          }
          if (isMergedRecall) {
            // Merged recall done - now check for unlearned beats or complete session
            setIsMergedRecall(false);
            if (newBeatToLearn) {
              setSessionMode('beat_preview');
              setCurrentBeatIndex(beats.findIndex(b => b.id === newBeatToLearn.id));
            } else {
              // Check for unlearned beats in the full beats array
              const nextUnlearned = beats.find(b => !b.is_mastered);
              if (nextUnlearned) {
                setNewBeatToLearn(nextUnlearned);
                setSessionMode('beat_preview');
                setCurrentBeatIndex(beats.findIndex(b => b.id === nextUnlearned.id));
              } else {
                console.log('✅ All recalls + merged recall complete — session done');
                setSessionMode('session_complete');
              }
            }
          } else if (recallIndex < beatsToRecall.length - 1) {
            // Move to next beat to recall
            setRecallIndex(prev => prev + 1);
            setRecallSuccessCount(0);
            setHiddenWordIndices(new Set());
            setHiddenWordOrder([]);
            resetForNextRep();
          } else {
            // Done with individual recalls - check if merged recall is needed
            if (mergedRecallBeats.length >= 2) {
              // HYBRID ENDURANCE DRILL: alternate between full-speech and
              // spot-reinforcement (weak beats + ending). Even counts → full
              // pass. Odd counts (with weak beats) → focused merge.
              const { beats: drillBeats, isFullSpeech } = selectBeatsForEnduranceDrill(
                mergedRecallBeats,
                enduranceDrillCounter
              );
              setEnduranceDrillCounter(prev => prev + 1);
              console.log(
                `🔗 ${isFullSpeech ? 'Full-speech' : 'Spot-reinforcement'} merge of ${drillBeats.length}/${mergedRecallBeats.length} beats`
              );
              const mergedBeat: Beat = {
                id: 'merged-recall',
                beat_order: -1,
                sentence_1_text: drillBeats.map(b => b.sentence_1_text).join(' '),
                sentence_2_text: drillBeats.map(b => b.sentence_2_text).join(' '),
                sentence_3_text: drillBeats.map(b => b.sentence_3_text).join(' '),
                is_mastered: true,
                mastered_at: null,
                last_recall_at: null,
                recall_10min_at: null,
                recall_evening_at: null,
                recall_morning_at: null,
              };
              // Keep mergedRecallBeats as the actual beats included so
              // `passed_in_full_speech` only flips for those that ran.
              setMergedRecallBeats(drillBeats);
              setIsMergedRecall(true);
              setBeatsToRecall([mergedBeat]);
              setRecallIndex(0);
              setRecallSuccessCount(0);
              setHiddenWordIndices(new Set());
              setHiddenWordOrder([]);
              resetForNextRep();
            } else if (newBeatToLearn) {
              // No merged recall needed - show beat preview before learning
              setSessionMode('beat_preview');
              setCurrentBeatIndex(beats.findIndex(b => b.id === newBeatToLearn.id));
            } else {
              // No new beat to learn - check for unlearned beats
              const nextUnlearned = beats.find(b => !b.is_mastered);
              if (nextUnlearned) {
                console.log('🔄 After recall, jumping to next unlearned beat:', nextUnlearned.beat_order);
                setNewBeatToLearn(nextUnlearned);
                setSessionMode('beat_preview');
                setCurrentBeatIndex(beats.findIndex(b => b.id === nextUnlearned.id));
              } else {
                console.log('✅ Recall-only session complete — schedule unchanged');
                setSessionMode('session_complete');
              }
            }
          }
        }, 1800);
      } else {
        // Need one more successful recall with all hidden
        setRecallSuccessCount(newCount);
        setCelebrationMessage(`${newCount}/2 perfect recalls`);
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          resetForNextRep();
        }, 800);
      }
    }
  }

  // Handle pre-beat recall mode completion (recall the just-mastered beat before learning next)
  // Similar to recall mode but simpler - just need 1 successful recall with all hidden
  function handlePreBeatRecallCompletion(hadErrors: boolean) {
    pauseSpeechRecognition(1200);

    const allHidden = hiddenWordIndices.size >= words.length;

    if (hadErrors) {
      // Failed: reveal failed words, reset progress, retry same visibility.
      // Do not hide any new words after an errored round.
      setPreBeatRecallSuccessCount(0);
      
      const failedIndices = new Set<number>();
      hesitatedIndicesRef.current.forEach(idx => failedIndices.add(idx));
      missedIndicesRef.current.forEach(idx => failedIndices.add(idx));
      
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      if (failedIndices.size > 0) {
        failedIndices.forEach(idx => newHidden.delete(idx));
        newOrder = newOrder.filter(idx => !failedIndices.has(idx));
      }
      
      setCelebrationMessage(t('common.try_again', 'Try again'));
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        resetForNextRep();
      }, 1200);
    } else if (!allHidden) {
      // Success but not all hidden yet - hide more words progressively 3 → 4 → 5
      const wordsToHide = Math.min(3 + preBeatRecallSuccessCount, 5);
      const newSuccessCount = preBeatRecallSuccessCount + 1;
      setPreBeatRecallSuccessCount(newSuccessCount);
      
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      for (let i = 0; i < wordsToHide; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        } else {
          break;
        }
      }
      
      const visibleCount = words.length - newHidden.size;
      setCelebrationMessage(`${visibleCount} words left`);
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        resetForNextRep();
      }, 800);
    } else {
      // All hidden and success! Pre-beat recall complete - now show the new beat preview
      setCelebrationMessage(t('beat_practice.recall_complete', "Ready for next beat!"));
      setShowCelebration(true);

      setTimeout(() => {
        setShowCelebration(false);
        
        // Now transition to beat preview for the new beat
        if (nextBeatQueued) {
          setNewBeatToLearn(nextBeatQueued);
          setCurrentBeatIndex(beats.findIndex(b => b.id === nextBeatQueued.id));
          setNextBeatQueued(null);
          setBeatToRecallBeforeNext(null);
          setPreBeatRecallSuccessCount(0);
          // Show beat preview first instead of jumping straight to learning
          setSessionMode('beat_preview');
        } else {
          // No next beat - session complete
          setSessionMode('session_complete');
        }
      }, 1500);
    }
  }

  // Track fading success count for progressive hiding (3 → 4 → 5)
  const [fadingSuccessCount, setFadingSuccessCount] = useState(0);
  
  // Handle fading phase completion logic
  // Key behavior: only hide more words after a clean repetition.
  // Failed words stay visible and become "protected" - they disappear LAST
  function handleFadingCompletion(hadErrors: boolean, failedSet: Set<number>) {
    const allHidden = hiddenWordIndices.size >= words.length;

    if (!allHidden) {
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      let newProtected = new Set(protectedWordIndices);
      
      // If there were errors, add failed words to protected set (they'll disappear last)
      // AND reveal them (make visible) so user can see what they missed
      if (hadErrors) {
        failedSet.forEach((idx) => {
          // Add to protected set - these words will be hidden LAST
          newProtected.add(idx);
          // Reveal the word (make visible)
          newHidden.delete(idx);
          // Remove from order if present
          const orderIdx = newOrder.indexOf(idx);
          if (orderIdx !== -1) {
            newOrder.splice(orderIdx, 1);
          }
        });
        setProtectedWordIndices(newProtected);
        setFadingSuccessCount(0); // Reset progression on error (back to 3 words)
        setConsecutiveNoScriptSuccess(0);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        setFailedWordIndices(new Set());
        resetForNextRep();
        return;
      } else {
        setFadingSuccessCount(prev => Math.min(prev + 1, 2)); // Cap at 2 (so max = 5)
      }
      
      const wordsToHide = Math.min(3 + fadingSuccessCount, 5);
      for (let i = 0; i < wordsToHide; i++) {
        // Pass the updated protected set to prioritize hiding non-protected words
        const nextToHide = getNextWordToHide(newHidden, newProtected);
        if (nextToHide !== null) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        } else {
          break;
        }
      }
      
      setHiddenWordIndices(newHidden);
      setHiddenWordOrder(newOrder);
      setFailedWordIndices(new Set());
      resetForNextRep();
    } else {
      // All words hidden - SUCCESS! 
      // Mark beat as mastered immediately after ONE successful no-script run
      // (Previously required 2 consecutive no-script successes, which confused users)
      if (phase === 'beat_fading') {
        console.log('🎉 Beat completed with all words hidden! Marking as mastered...');
        showBeatCelebration();
      } else {
        showSentenceCelebration();
      }
    }
  }

  // User-triggered: hide a chunk more words right now to skip ahead in the
  // fading progression. Useful when the user already knows the beat and wants
  // to jump to fewer visible words without grinding through every rep.
  const jumpHideAhead = useCallback(() => {
    if (showCelebration) return;
    let newHidden = new Set(hiddenWordIndicesRef.current);
    const newOrder = [...hiddenWordOrder];
    const jumpSize = 5;
    let added = 0;
    for (let i = 0; i < jumpSize; i++) {
      const nextToHide = getNextWordToHide(newHidden, protectedWordIndices);
      if (nextToHide === null) break;
      newHidden.add(nextToHide);
      newOrder.push(nextToHide);
      added++;
    }
    if (added === 0) return;
    setHiddenWordIndices(newHidden);
    setHiddenWordOrder(newOrder);
    setFailedWordIndices(new Set());
    setFadingSuccessCount(prev => Math.min(prev + 1, 2));
    resetForNextRep();
  }, [hiddenWordOrder, protectedWordIndices, getNextWordToHide, showCelebration]);

  // Recall variant: hide ALL remaining words so the user has to recite the
  // entire beat from memory in one go. This is the "jump over" button during
  // recall — it does NOT auto-complete; the user still has to say every word.
  const jumpHideAllRecall = useCallback(() => {
    if (showCelebration) return;
    const allHidden = new Set<number>();
    const newOrder = [...hiddenWordOrder];
    for (let i = 0; i < words.length; i++) {
      allHidden.add(i);
      if (!hiddenWordIndicesRef.current.has(i)) newOrder.push(i);
    }
    setHiddenWordIndices(allHidden);
    setHiddenWordOrder(newOrder);
    setFailedWordIndices(new Set());
    resetForNextRep();
  }, [hiddenWordOrder, words.length, showCelebration]);

  const resetForNextRep = () => {
    const now = Date.now();
    const hadActiveRecognizer = Boolean(recognitionRef.current);
    repetitionIdRef.current += 1;
    lastResetAtRef.current = now;
    // Stale-replay guard: the native/Web Speech buffer was already cleared by
    // pauseSpeechRecognition (clearBuffer + ignoreResultsBeforeIndexRef), so we
    // only need a brief safety window here. A long guard (was 700ms) made the
    // recognizer feel unresponsive when entering sentence 2 / new phases — the
    // user would speak immediately and the first ~700ms of words were dropped.
    staleReplayGuardUntilRef.current = hadActiveRecognizer ? now + 250 : 0;
    // Minimal ignore window — but never shorten a longer pause that was set
    // by completion/phase transitions. Shortening it lets stale final results
    // from the previous rep immediately advance the next rep/session.
    ignoreResultsUntilRef.current = Math.max(ignoreResultsUntilRef.current, now + 150);

    // Planned pauses must run every repetition of the same sentence/beat, not
    // only when the visible text changes between phases.
    triggeredPausesRef.current = new Set();
    postPauseNoHesitationIndicesRef.current = new Set();
    setActivePause(null);
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    currentWordIndexRef.current = 0;
    setCurrentWordIndex(0);

    spokenIndicesRef.current = new Set();
    hesitatedIndicesRef.current = new Set();
    missedIndicesRef.current = new Set();

    setSpokenIndices(new Set());
    setHesitatedIndices(new Set());
    setMissedIndices(new Set());
    setFailedWordIndices(new Set());

    transcriptRef.current = "";
    transcriptWordsRef.current = [];
    runningTranscriptRef.current = "";
    // Skip everything the recognizer has already buffered. Otherwise the same
    // sentence that just completed can replay into the next repetition and be
    // counted as if the user had spoken it again, which made words fade too early.
    ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current;
    try {
      (recognitionRef.current as { clearBuffer?: () => void } | null)?.clearBuffer?.();
    } catch {
      // Ignore buffer-clear failures; the result-index guard still protects us.
    }
    hasHeardSpeechRef.current = false;
    lastWordTimeRef.current = now;
    lastAutoAdvanceAtRef.current = 0;
  };

  const transitionToPhase = (newPhase: Phase) => {
    // HARD synchronous reset of all refs FIRST so any in-flight speech
    // recognition callback / hesitation tick that fires between this call and
    // the next React render cannot operate on stale sentence-1 indices.
    // Without this, a buffered transcript token from the previous sentence's
    // fading round could leak into the new sentence and (a) advance the
    // cursor past words and (b) re-trigger hidden-word side effects.
    hiddenWordIndicesRef.current = new Set();
    spokenIndicesRef.current = new Set();
    hesitatedIndicesRef.current = new Set();
    missedIndicesRef.current = new Set();
    postPauseNoHesitationIndicesRef.current = new Set();
    currentWordIndexRef.current = 0;
    transcriptRef.current = "";
    transcriptWordsRef.current = [];
    runningTranscriptRef.current = "";
    hasHeardSpeechRef.current = false;
    lastWordTimeRef.current = Date.now();
    lastAutoAdvanceAtRef.current = Date.now();
    // Short ignore window: result-index filtering drops old buffered words,
    // while keeping the next first word responsive if the user starts quickly.
    ignoreResultsUntilRef.current = Math.max(ignoreResultsUntilRef.current, Date.now() + 350);

    // Bump phase epoch so any in-flight processTranscription / hesitation
    // callback that was captured with the previous phase exits early.
    phaseEpochRef.current += 1;
    needsFreshSpeechRef.current = true;
    phaseTransitionAtRef.current = Date.now();

    // Skip all currently buffered speech-results indices. Without this, the
    // recognizer's `event.results` array (which we deliberately never abort
    // to avoid the iOS mic chime) would replay sentence-1 finals into the
    // running transcript on the very next onresult tick, falsely matching
    // common stop-words in sentence 2 and auto-completing the read-through.
    ignoreResultsBeforeIndexRef.current = latestSpeechResultCountRef.current;

    setPhase(newPhase);
    setRepetitionCount(1);
    repetitionCountRef.current = 1;
    setHiddenWordIndices(new Set());
    setHiddenWordOrder([]);
    setProtectedWordIndices(new Set()); // Clear protected words for new phase
    setConsecutiveNoScriptSuccess(0);
    setFadingSuccessCount(0); // Reset progressive hiding for new phase

    lastCompletionRepIdRef.current = -1;
    pauseSpeechRecognition(350);
    resetForNextRep();
    
    // Clear checkpoint when transitioning to a new sentence/phase (user made progress)
    if (currentBeat) {
      supabase
        .from('practice_beats')
        .update({ 
          checkpoint_sentence: null, 
          checkpoint_phase: null,
          checkpoint_hidden_indices: null 
        })
        .eq('id', currentBeat.id)
        .then(() => {});
    }
  };

  // Save checkpoint when user exits mid-session
  const saveCheckpoint = async () => {
    if (!currentBeat || sessionMode !== 'learn') return;
    
    const sentenceNumber = getCurrentSentenceNumber();
    const hiddenIndicesArray = Array.from(hiddenWordIndices);
    
    try {
      await supabase
        .from('practice_beats')
        .update({
          checkpoint_sentence: sentenceNumber,
          checkpoint_phase: phase,
          checkpoint_hidden_indices: hiddenIndicesArray,
        })
        .eq('id', currentBeat.id);
      
      console.log('💾 Checkpoint saved at sentence', sentenceNumber, 'phase', phase);
    } catch (error) {
      console.error('Failed to save checkpoint:', error);
    }
  };

  const showSentenceCelebration = () => {
    const currentPhase = phase;
    const uniqueCount = currentBeat ? getUniqueSentences(currentBeat).length : 3;
    
    resetForNextRep();

    let message = t('beat_practice.excellent_next');
    if (currentPhase === 'sentence_2_fading') {
      message = t('beat_practice.lets_combine', "Let's combine them!");
    } else if (currentPhase === 'sentence_3_fading') {
      message = t('beat_practice.final_combine', "Now all together!");
    }
    setCelebrationMessage(message);

    setTimeout(() => {
      setShowCelebration(true);

      setTimeout(() => {
        setShowCelebration(false);

        // For short speeches with fewer unique sentences, skip to beat phase sooner
        if (uniqueCount === 1) {
          // Only 1 sentence - go straight to beat fading after sentence 1
          transitionToPhase('beat_learning');
        } else if (uniqueCount === 2) {
          // 2 sentences - practice each alone, then combine (1+2 IS the whole beat)
          if (currentPhase === 'sentence_1_fading') {
            transitionToPhase('sentence_2_learning');
          } else if (currentPhase === 'sentence_2_fading') {
            transitionToPhase('sentences_1_2_learning');
          } else if (currentPhase === 'sentences_1_2_fading') {
            // For 2 sentences, combined 1+2 IS the full beat - mark as mastered
            showBeatCelebration();
            return;
          }
        } else {
          // 3 sentences - normal flow
          if (currentPhase === 'sentence_1_fading') {
            transitionToPhase('sentence_2_learning');
          } else if (currentPhase === 'sentence_2_fading') {
            transitionToPhase('sentences_1_2_learning');
          } else if (currentPhase === 'sentences_1_2_fading') {
            transitionToPhase('sentence_3_learning');
          } else if (currentPhase === 'sentence_3_fading') {
            transitionToPhase('beat_learning');
          }
        }
      }, 2000);
    }, 150);
  };

  const showBeatCelebration = async () => {
    // Mark beat as mastered with timestamp and advance to next practice stage
    if (currentBeat) {
      console.log('🏆 Marking beat as mastered:', currentBeat.id);
      
      // Calculate recall timestamps for spaced repetition
      const now = new Date();
      const recall10minAt = new Date(now.getTime() + 10 * 60 * 1000);
      
      // Evening recall: same day at 8 PM (or 2+ hours later if mastered after 6 PM)
      const eveningTarget = new Date(now);
      eveningTarget.setHours(20, 0, 0, 0); // 8 PM today
      let recallEveningAt: Date;
      if (now.getHours() >= 20) {
        // Already past 8 PM — skip evening, let morning recall take over
        recallEveningAt = eveningTarget; // in the past, won't trigger
      } else if (now.getHours() >= 18) {
        // Mastered between 6 PM and 8 PM — schedule 2 hours from now
        recallEveningAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      } else {
        recallEveningAt = eveningTarget;
      }
      
      // Morning recall: next day at 6 AM (always available from 6 AM local time)
      const recallMorningAt = new Date(now);
      recallMorningAt.setDate(recallMorningAt.getDate() + 1);
      recallMorningAt.setHours(6, 0, 0, 0);
      
      console.log('📅 Scheduling recalls:', {
        '10min': recall10minAt.toISOString(),
        'evening': recallEveningAt.toISOString(),
        'morning': recallMorningAt.toISOString(),
      });
      
      const { error: updateError } = await supabase
        .from('practice_beats')
        .update({ 
          is_mastered: true, 
          mastered_at: now.toISOString(),
          // Schedule recalls
          recall_10min_at: recall10minAt.toISOString(),
          recall_evening_at: recallEveningAt.toISOString(),
          recall_morning_at: recallMorningAt.toISOString(),
          // Initialize 2/3/5/7 schedule
          recall_session_number: 0,
          next_scheduled_recall_at: null, // Will be set after morning recall (session 1 complete)
          // Advance stage: day1_sentences → day2_beats (for next day's practice)
          practice_stage: 'day2_beats',
          words_hidden_per_round: 2,
          stage_started_at: now.toISOString(),
          consecutive_perfect_recalls: 0,
          // Clear checkpoint since beat is now mastered
          checkpoint_sentence: null,
          checkpoint_phase: null,
          checkpoint_hidden_indices: null,
        })
        .eq('id', currentBeat.id);
      
      if (updateError) {
        console.error('❌ Failed to mark beat as mastered:', updateError);
        toast({
          variant: "destructive",
          title: "Error saving progress",
          description: "Please try again.",
        });
        return;
      }
      
      console.log('✅ Beat marked as mastered successfully, 10min recall at:', recall10minAt.toISOString());
      
      // NOTE: legacy SM-2 `schedules` / `speeches.next_review_date` writes
      // were removed here. The beat flow uses `practice_beats.recall_*_at`
      // (short cycle) and FSRS (`next_scheduled_recall_at`) exclusively.
      // Writing to `schedules` was overwriting FSRS's interval with a flat
      // 4–24h fallback and causing spurious locks in Practice.tsx.
      
      // Update local state so the completion screen shows correct count
      const updatedBeats = beats.map(b => 
        b.id === currentBeat.id 
          ? { ...b, is_mastered: true, mastered_at: now.toISOString(), recall_10min_at: recall10minAt.toISOString(), recall_evening_at: recallEveningAt.toISOString(), recall_morning_at: recallMorningAt.toISOString() }
          : b
      );
      setBeats(updatedBeats);
      
      // Find next unmastered beat for premium users
      const nextUnmastered = updatedBeats.find(b => !b.is_mastered);
      
      // Count how many beats were mastered today (including the one just mastered)
      const beatsLearnedToday = updatedBeats.filter(b => {
        if (!b.mastered_at) return false;
        const masteredDate = new Date(b.mastered_at);
        return masteredDate.toDateString() === new Date().toDateString();
      }).length;
      
      // Check if we need to learn more beats today
      // Allow ALL users to continue to next beat in the same session (not just premium)
      // Daily limit still applies for free users - they can't start new sessions beyond their limit
      const shouldContinueToday = nextUnmastered && beatsLearnedToday < beatsPerDay;
      
      if (shouldContinueToday && nextUnmastered) {
        // Always take a 10-min coffee break before the pre-beat recall.
        const justMasteredBeat = currentBeat;
        setNextBeatQueued(nextUnmastered);
        setBeatToRecallBeforeNext(justMasteredBeat);

        setCelebrationMessage(t('beat_practice.beat_complete', "Beat complete! Coffee break time."));
        setShowCelebration(true);

        setTimeout(() => {
          setShowCelebration(false);
          if (justMasteredBeat) {
            console.log('☕ Starting 10-min coffee break before next beat:', justMasteredBeat.id);
            setIsEndOfSessionRecall(false);
            setBeatsToRecall([justMasteredBeat]);
            setRestUntilTime(new Date(Date.now() + 10 * 60 * 1000));
            setRestMinutes(10);
            setShowSkipWarning(false);
            setSessionMode('coffee_break');

            if ('Notification' in window && Notification.permission === 'granted') {
              setTimeout(() => {
                new Notification('Coffee break is over!', {
                  body: 'Time for your quick recall session. Come back and practice!',
                  icon: '/favicon.ico',
                });
              }, 10 * 60 * 1000);
            } else if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
          }
        }, 2000);
      } else {
        // Session ending: show coffee break with 10-min timer, then recall
        setCelebrationMessage(t('beat_practice.beat_complete', "Beat complete! Coffee break time."));
        setShowCelebration(true);
        
        // Store the beat for recall after coffee break
        const justMasteredBeat = currentBeat;
        
        setTimeout(() => {
          setShowCelebration(false);
          if (justMasteredBeat) {
            console.log('☕ Starting 10-min coffee break for beat:', justMasteredBeat.id);
            setIsEndOfSessionRecall(true);
            setBeatsToRecall([justMasteredBeat]);
            setRestUntilTime(new Date(Date.now() + 10 * 60 * 1000));
            setRestMinutes(10);
            setShowSkipWarning(false);
            setSessionMode('coffee_break');
            
            // Schedule browser notification after 10 minutes
            if ('Notification' in window && Notification.permission === 'granted') {
              setTimeout(() => {
                new Notification('Coffee break is over!', {
                  body: 'Time for your quick recall session. Come back and practice!',
                  icon: '/favicon.ico',
                });
              }, 10 * 60 * 1000);
            } else if ('Notification' in window && Notification.permission === 'default') {
              Notification.requestPermission();
            }
          } else {
            setSessionMode('session_complete');
          }
          // Check if free user has more beats to learn (trigger upsell for next session)
          if (!isPremium && nextUnmastered) {
            onSessionLimitReached?.();
          }
        }, 2500);
      }
    }
  };
  // Start next beat after rest period - first requires recalling the previous beat
  const startNextBeat = () => {
    if (!nextBeatQueued) return;
    
    setRestUntilTime(null);
    setRestMinutes(0);
    
    // If there's a beat to recall first (the one we just mastered), go to pre_beat_recall mode
    if (beatToRecallBeforeNext) {
      // Initialize pre-beat recall mode - start with all words visible, fade progressively
      setPreBeatRecallSuccessCount(0);
      setHiddenWordIndices(new Set());
      setHiddenWordOrder([]);
      setProtectedWordIndices(new Set());
      setPhase('beat_fading'); // Use beat_fading phase for full beat recall
      setSessionMode('pre_beat_recall');
      resetForNextRep();
    } else {
      // No previous beat to recall - go directly to learning
      setNewBeatToLearn(nextBeatQueued);
      setCurrentBeatIndex(beats.findIndex(b => b.id === nextBeatQueued.id));
      setNextBeatQueued(null);
      setSessionMode('learn');
      transitionToPhase('sentence_1_learning');
    }
  };

  // Start recording — uses native Speech Recognition on iOS/Android (Capacitor)
  // and Web Speech API on the browser. Native is far more responsive on mobile.
  const startRecording = async () => {
    if (recognitionRef.current) return;

    setIsSpeechReady(false);
    if (speechReadyTimeoutRef.current) {
      clearTimeout(speechReadyTimeoutRef.current);
      speechReadyTimeoutRef.current = null;
    }
    latestSpeechResultCountRef.current = 0;
    ignoreResultsBeforeIndexRef.current = 0;
    resetForNextRep();
    // A fresh recording has no stale recognizer results yet. Keeping the normal
    // transition debounce here can swallow the user's first word if they start
    // speaking immediately after tapping the mic.
    ignoreResultsUntilRef.current = 0;

    const isNative = Capacitor.isNativePlatform();
    const lang = getRecognitionLocale(speechLang);

    try {
      if (isNative) {
        // ---- Native (iOS/Android) path ----
        try {
          const { available } = await NativeSpeech.available();
          if (!available) throw new Error("Native speech recognition unavailable");

          const perm = await NativeSpeech.checkPermissions();
          if (perm.speechRecognition !== "granted") {
            const req = await NativeSpeech.requestPermissions();
            if (req.speechRecognition !== "granted") {
              toast({
                variant: "destructive",
                title: "Microphone Access Denied",
                description: "Please allow microphone & speech access in iOS Settings.",
              });
              return;
            }
          }

          // Track cumulative transcript across multiple short native sessions.
          // The native plugin returns the *current utterance* — we have to
          // accumulate finals ourselves to emulate Web Speech's continuous mode.
          const nativeFinalsRef = { current: "" };
          let lastNativeInterim = "";
          let listenerHandle: any = null;
          let partialHandle: any = null;
          let stopped = false;

          // Watchdog: if no partial result arrives within 15s, force restart.
          // Some Android builds silently stop listening without firing the
          // "stopped" status — this keeps recognition alive.
          let lastActivityAt = Date.now();
          const watchdog = setInterval(() => {
            if (stopped || !isRecordingRef.current) return;
            if (Date.now() - lastActivityAt > 15000) {
              lastActivityAt = Date.now();
              NativeSpeech.stop().catch(() => {});
              setTimeout(() => {
                if (!stopped && isRecordingRef.current) startNativeSession();
              }, 120);
            }
          }, 3000);

          const startNativeSession = async () => {
            if (stopped || !isRecordingRef.current) return;
            try {
              await NativeSpeech.start({
                language: lang,
                maxResults: 1,
                prompt: "",
                partialResults: true,
                popup: false,
              });
              lastActivityAt = Date.now();
            } catch (e) {
              console.warn("Native start failed, retrying", e);
              if (!stopped && isRecordingRef.current) {
                setTimeout(startNativeSession, 300);
              }
            }
          };


          partialHandle = await NativeSpeech.addListener(
            "partialResults" as any,
            (data: any) => {
              if (showCelebrationRef.current) return;
              if (Date.now() < ignoreResultsUntilRef.current) return;
              lastActivityAt = Date.now();
              setIsSpeechReady(true);

              const matches: string[] = data?.matches ?? [];
              const interim = matches[0] ?? "";
              lastNativeInterim = interim;
              const combined = (nativeFinalsRef.current + " " + interim).trim();
              processTranscriptionRef.current(
                combined,
                false,
                repetitionIdRef.current,
                phaseEpochRef.current
              );
            }
          );

          listenerHandle = await NativeSpeech.addListener(
            "listeningState" as any,
            async (data: any) => {
              if (data?.status === "started" || data?.status === "listening") {
                setIsSpeechReady(true);
              }
              if (data?.status === "stopped" && !stopped && isRecordingRef.current) {
                // Promote whatever interim was last seen into finals so we keep history.
                if (lastNativeInterim.trim()) {
                  nativeFinalsRef.current = (nativeFinalsRef.current + " " + lastNativeInterim).trim();
                  lastNativeInterim = "";
                }
                // Restart immediately to emulate continuous listening.
                setTimeout(startNativeSession, 50);
              }
            }
          );

          // We expose a thin "recognition object" so the rest of the component
          // (which reads recognitionRef.current to know it's running) keeps working.
          recognitionRef.current = {
            __native: true,
            clearBuffer: () => {
              nativeFinalsRef.current = "";
              lastNativeInterim = "";
            },
            stop: async () => {
              stopped = true;
              clearInterval(watchdog);
              try {
                await NativeSpeech.stop();
              } catch {}
              try {
                await partialHandle?.remove?.();
                await listenerHandle?.remove?.();
              } catch {}
            },

          };

          isRecordingRef.current = true;
          setIsRecording(true);
          runningTranscriptRef.current = "";
          lastWordTimeRef.current = Date.now();

          await startNativeSession();
          if (isRecordingRef.current) setIsSpeechReady(true);
          speechReadyTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) setIsSpeechReady(true);
          }, 450);
        } catch (nativeErr) {
          console.error("Native speech failed, falling back to Web Speech:", nativeErr);
          // Fall through to Web Speech below
        }
      }

      if (!recognitionRef.current) {
        // ---- Web Speech API path ----
        const SpeechRecognition =
          (window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          toast({
            variant: "destructive",
            title: "Not Supported",
            description:
              "Speech recognition is not supported in this browser. Try Chrome or Safari.",
          });
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = lang;
        console.log("🗣️ Speech recognition language:", recognition.lang);

        runningTranscriptRef.current = "";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          if (showCelebrationRef.current) return;
          if (Date.now() < ignoreResultsUntilRef.current) return;
          setIsSpeechReady(true);

          latestSpeechResultCountRef.current = Math.max(
            latestSpeechResultCountRef.current,
            event.results.length
          );

          const currentRepId = repetitionIdRef.current;
          const currentPhaseEpoch = phaseEpochRef.current;
          let interim = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (i < ignoreResultsBeforeIndexRef.current) continue;
            const res = event.results[i];
            const chunk = res?.[0]?.transcript ?? "";
            if (res.isFinal) runningTranscriptRef.current += chunk + " ";
            else interim += chunk + " ";
          }

          const combined = (runningTranscriptRef.current + interim).trim();
          const lastIsFinal = event.results.length
            ? event.results[event.results.length - 1].isFinal
            : false;
          processTranscriptionRef.current(combined, lastIsFinal, currentRepId, currentPhaseEpoch);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsSpeechReady(false);
          if (event.error === "not-allowed") {
            toast({
              variant: "destructive",
              title: "Microphone Access Denied",
              description: "Please allow microphone access to use speech recognition.",
            });
          }
        };

        recognition.onend = () => {
          setIsSpeechReady(false);
          if (!isRecordingRef.current) return;
          if (!recognitionRef.current) return;

          // The Web Speech engine restarts with a fresh `event.results` array
          // (indices reset to 0). Any leftover `ignoreResultsBeforeIndexRef`
          // value from the previous session (set by resetForNextRep / pauses
          // to the cumulative final-count) would now filter out ALL incoming
          // results until the new index caught up — which felt like the mic
          // suddenly going deaf mid-sentence after ~10 spoken words.
          latestSpeechResultCountRef.current = 0;
          ignoreResultsBeforeIndexRef.current = 0;
          // Also drop the running transcript: the previous session's finals
          // were already consumed by the matcher. Keeping them around would
          // cause the freshly restarted engine to re-feed stale text into
          // processTranscription and freeze the cursor mid-sentence after a
          // silence-triggered restart (the classic "workflow stops after a
          // few words disappear" symptom in fading rounds).
          runningTranscriptRef.current = "";

          const startSafely = () => {
            if (!isRecordingRef.current) return;
            if (!recognitionRef.current) return;
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.log("Recognition already started");
            }
          };

          const waitMs = recognitionRestartAtRef.current - Date.now();
          if (waitMs > 0) {
            if (recognitionRestartTimeoutRef.current) {
              clearTimeout(recognitionRestartTimeoutRef.current);
            }
            recognitionRestartTimeoutRef.current = setTimeout(startSafely, waitMs);
            return;
          }

          startSafely();
        };

        recognitionRef.current = recognition;
        isRecordingRef.current = true;
        setIsRecording(true);
        recognition.onstart = () => {
          speechReadyTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) setIsSpeechReady(true);
          }, 250);
        };
        recognition.start();
        lastWordTimeRef.current = Date.now();
      }

      // Hesitation timer (shared between both engines)
      hesitationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastWordTimeRef.current;
        const idx = currentWordIndexRef.current;
        const hesitationMs = getHesitationThresholdMs();
        const currentIsHidden = hiddenWordIndicesRef.current.has(idx);
        if ((hasHeardSpeechRef.current || currentIsHidden) && elapsed > hesitationMs && idx < wordsLengthRef.current) {
          if (currentIsHidden) {
            if (postPauseNoHesitationIndicesRef.current.has(idx)) {
              return;
            }
            if (!hesitatedIndicesRef.current.has(idx)) {
              const newHesitated = new Set([...hesitatedIndicesRef.current, idx]);
              hesitatedIndicesRef.current = newHesitated;
              setHesitatedIndices(newHesitated);

              console.log(
                `⏭️ Revealing and advancing past hesitated word "${words[idx]}" at index ${idx} after ${hesitationMs / 1000}s`
              );
              const newSpoken = new Set([...spokenIndicesRef.current, idx]);
              spokenIndicesRef.current = newSpoken;
              setSpokenIndices(newSpoken);
              postPauseNoHesitationIndicesRef.current.delete(idx);
              const nextIdx = idx + 1;
              currentWordIndexRef.current = nextIdx;
              setCurrentWordIndex(nextIdx);
              hasHeardSpeechRef.current = false;
              lastWordTimeRef.current = Date.now();
              lastAutoAdvanceAtRef.current = Date.now();
              // Clear buffered transcript so old recognition results cannot
              // cascade-advance the next word/sentence.
              transcriptRef.current = "";
              transcriptWordsRef.current = [];
              runningTranscriptRef.current = "";
              ignoreResultsUntilRef.current = Date.now() + 400;
              if (nextIdx >= wordsLengthRef.current) {
                const failedFromSignals = new Set<number>();
                hiddenWordIndicesRef.current.forEach((hiddenIdx) => {
                  if (hesitatedIndicesRef.current.has(hiddenIdx) || missedIndicesRef.current.has(hiddenIdx)) {
                    failedFromSignals.add(hiddenIdx);
                  }
                });
                checkCompletion(newSpoken, failedFromSignals);
              }
              // Note: no transcript replay — that caused cascading skips.
            }
          } else {
            // VISIBLE word safety net: if the matcher has failed to advance a
            // visible word for ~6s while the user is clearly speaking, advance
            // it silently. Without this the blue cursor could stay frozen on a
            // visible word forever (e.g. speech recognition mishears "Ladies").
            const VISIBLE_STUCK_MS = 6000;
            if (
              hasHeardSpeechRef.current &&
              elapsed > VISIBLE_STUCK_MS &&
              !postPauseNoHesitationIndicesRef.current.has(idx)
            ) {
              console.log(
                `⏭️ Visible word "${words[idx]}" at index ${idx} stuck for ${(elapsed / 1000).toFixed(1)}s — auto-advancing`
              );
              const newSpoken = new Set([...spokenIndicesRef.current, idx]);
              spokenIndicesRef.current = newSpoken;
              setSpokenIndices(newSpoken);
              const nextIdx = idx + 1;
              currentWordIndexRef.current = nextIdx;
              setCurrentWordIndex(nextIdx);
              hasHeardSpeechRef.current = false;
              lastWordTimeRef.current = Date.now();
              lastAutoAdvanceAtRef.current = Date.now();
              transcriptRef.current = "";
              transcriptWordsRef.current = [];
              runningTranscriptRef.current = "";
              ignoreResultsUntilRef.current = Date.now() + 400;
              if (nextIdx >= wordsLengthRef.current) {
                checkCompletion(newSpoken);
              }
            }
          }
        }
      }, 500);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        variant: "destructive",
        title: "Recording Failed",
        description: "Could not start speech recognition. Please try again.",
      });
    }
  };

  const stopListening = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsSpeechReady(false);

    recognitionRestartAtRef.current = 0;
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }
    if (speechReadyTimeoutRef.current) {
      clearTimeout(speechReadyTimeoutRef.current);
      speechReadyTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        const r = recognitionRef.current;
        if (r.__native) {
          // async stop, fire & forget
          r.stop();
        } else {
          r.stop();
        }
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (hesitationTimerRef.current) {
      clearInterval(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }, []);

  // Auto-start listening (no button press)
  useEffect(() => {
    if (loading) return;
    if (!currentBeat) return;
    if (showCelebration) return;
    if (recognitionRef.current) return;
    if (sessionMode === 'session_complete') return;
    if (sessionMode === 'beat_rest') return;
    if (sessionMode === 'beat_preview') return;
    if (sessionMode === 'coffee_break') return;

    startRecording();
  }, [loading, currentBeat?.id, showCelebration, phase, sessionMode, recallIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Beat preview screen - show upcoming beat before learning
  if (sessionMode === 'beat_preview' && newBeatToLearn) {
    // Preview shows all unique sentences in the beat (full read-through)
    const uniqueSentences = getUniqueSentences(newBeatToLearn);
    const previewBeatText = uniqueSentences.join(' ');
    
    const beatNumber = beats.findIndex(b => b.id === newBeatToLearn.id) + 1;
    
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border/30" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Exit button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onExit}
              className="shrink-0 rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
            
            {/* Full Speech Button */}
            {fullSpeechText && (
              <Sheet open={showFullSpeechModal} onOpenChange={setShowFullSpeechModal}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span className="text-xs">{t('beat_practice.full_speech', 'Full Speech')}</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[80vh]">
                  <SheetHeader>
                    <SheetTitle>{t('beat_practice.full_speech', 'Full Speech')}</SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(80vh-80px)] mt-4">
                    <p className="text-base leading-relaxed whitespace-pre-wrap pr-4">
                      {fullSpeechText}
                    </p>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            )}
            
            {/* Beat badge */}
            <div className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold bg-primary/20 text-primary">
              {t('beat_practice.beat_number', { number: beatNumber, defaultValue: `Beat ${beatNumber}` })}
            </div>
          </div>
        </div>

        {/* Main content - Preview card - scrollable for long text */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="w-full max-w-2xl mx-auto space-y-6 min-h-full flex flex-col justify-center">
            {/* Preview header */}
            <div className="flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Eye className="h-12 w-12 text-primary" />
              </motion.div>
              <h2 className="text-xl font-semibold text-foreground">
                {t('beat_practice.coming_up', 'Coming up...')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('beat_practice.read_through', 'Read through once, then practice')}
              </p>
            </div>

            {/* Beat text card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card rounded-3xl border border-border/50 shadow-lg p-6 md:p-10"
            >
              <p className="text-lg md:text-xl leading-relaxed text-foreground text-left">
                {previewBeatText}
              </p>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-3"
            >
              <Button
                size="lg"
                className="w-full max-w-sm"
                onClick={() => {
                  setSessionMode('learn');
                  transitionToPhase('sentence_1_learning');
                }}
              >
                <Play className="h-4 w-4 mr-2" />
                {t('beat_practice.ready_to_practice', "I'm Ready to Practice")}
              </Button>
              
            </motion.div>
          </div>
        </div>
      </div>
    );
  }


  // Pre-beat recall intro screen - animated transition before recalling old beat
  if (sessionMode === 'pre_beat_recall' && showPreBeatRecallIntro && beatToRecallBeforeNext) {
    const introRecallBeatNumber = beats.findIndex(b => b.id === beatToRecallBeforeNext.id) + 1;
    const nextBeatNumber = nextBeatQueued ? beats.findIndex(b => b.id === nextBeatQueued.id) + 1 : null;
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        {/* Exit button */}
        <div className="absolute left-4" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <Button variant="ghost" size="icon" onClick={onExit} className="rounded-full hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
        
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, duration: 0.6 }}
          className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center"
        >
          <RotateCcw className="h-10 w-10 text-purple-500" />
        </motion.div>
        
        <motion.h2 
          className="text-2xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {t('beat_practice.recall_intro_title', "Quick Recall")}
        </motion.h2>
        
        <motion.p 
          className="text-muted-foreground max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t('beat_practice.recall_intro_desc', {
            beatNumber: introRecallBeatNumber,
            defaultValue: `Before the next beat, let's make sure you still remember Beat ${introRecallBeatNumber}.`
          })}
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-muted/50 rounded-xl px-4 py-3 max-w-sm"
        >
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            {t('beat_practice.recall_intro_hint', "Words will progressively hide as you speak correctly. Common words are pre-hidden.")}
          </p>
        </motion.div>
        
        {nextBeatNumber && (
          <motion.p
            className="text-xs text-muted-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
          >
            {t('beat_practice.recall_intro_next', { beatNumber: nextBeatNumber, defaultValue: `Next up: Beat ${nextBeatNumber}` })}
          </motion.p>
        )}
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Button 
            onClick={() => { setShowPreBeatRecallIntro(false); resetForNextRep(); }}
            className="mt-2 gap-2"
            size="lg"
          >
            <Play className="h-4 w-4" />
            {t('beat_practice.start_recall', "Start Recall")}
          </Button>
        </motion.div>
      </div>
    );
  }

  // Coffee break screen - 10 min timer before recall
  if (sessionMode === 'coffee_break' && restUntilTime) {
    
    const startCoffeeBreakRecall = () => {
      setRestUntilTime(null);
      setRestMinutes(0);

      // Between-beats: continue into the pre-beat recall flow we queued.
      if (!isEndOfSessionRecall && beatToRecallBeforeNext) {
        setShowPreBeatRecallIntro(true);
        setPreBeatRecallSuccessCount(0);
        setHiddenWordIndices(new Set());
        setHiddenWordOrder([]);
        setProtectedWordIndices(new Set());
        setPhase('beat_fading');
        const idx = beats.findIndex(b => b.id === beatToRecallBeforeNext.id);
        if (idx >= 0) setCurrentBeatIndex(idx);
        setSessionMode('pre_beat_recall');
        return;
      }

      // End-of-session: 10-min recall of the just-mastered beat.
      setIs10MinRecall(true);
      setRecallIndex(0);
      setRecallSuccessCount(0);
      setHiddenWordIndices(new Set());
      setHiddenWordOrder([]);
      setSessionMode('recall');
    };

    const handleSkipClick = () => {
      if (isPremium) {
        setShowSkipWarning(true);
      }
    };

    return (
      <div
        className="flex flex-col items-center h-full overflow-y-auto p-8 text-center gap-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6rem)" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="text-7xl"
        >
          <Coffee className="h-16 w-16 text-amber-600 dark:text-amber-400" />
        </motion.div>
        
        <motion.h2 
          className="text-2xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {t('beat_practice.coffee_break_title', "Coffee Break!")}
        </motion.h2>
        
        <motion.p 
          className="text-muted-foreground max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {t('beat_practice.coffee_break_desc', "Great job! Take a 10-minute break to let your brain consolidate what you just learned. A quick recall will start when the timer runs out.")}
        </motion.p>
        
        {/* Countdown timer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
        >
          <RestCountdown 
            targetTime={restUntilTime} 
            onComplete={startCoffeeBreakRecall}
            restMinutes={restMinutes}
          />
        </motion.div>
        
        <motion.div 
          className="flex flex-col gap-2 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t('beat_practice.coffee_notification', "You'll receive a notification when it's time to practice")}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('beat_practice.coffee_tip', "Tip: Take a short walk or grab a coffee!")}
          </p>
        </motion.div>
        
        {/* Skip button - premium only */}
        {isPremium ? (
          <>
            <Button variant="ghost" onClick={handleSkipClick} className="mt-4 text-muted-foreground">
              <Play className="h-4 w-4 mr-2" />
              {t('beat_practice.skip_break', "Start recall now")}
            </Button>
            
            {/* Warning dialog for premium users */}
            <AnimatePresence>
              {showSkipWarning && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-warning/10 border border-warning/30 rounded-xl p-4 max-w-sm"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-semibold text-warning text-sm">
                      {t('beat_practice.skip_warning_title', "Are you sure?")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('beat_practice.skip_warning_desc', "The 10-minute break helps your brain consolidate what you just learned. Skipping it may reduce retention.")}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowSkipWarning(false)} className="flex-1">
                      {t('beat_practice.keep_waiting', "Keep waiting")}
                    </Button>
                    <Button size="sm" variant="default" onClick={startCoffeeBreakRecall} className="flex-1">
                      {t('beat_practice.skip_anyway', "Skip anyway")}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => setShowCoffeePremiumUpsell(true)}
              className="mt-4 text-muted-foreground"
            >
              <Crown className="h-4 w-4 mr-2 text-amber-500" />
              {t('beat_practice.skip_break_locked', "Skip the break")}
            </Button>
            <PremiumUpgradeDialog
              open={showCoffeePremiumUpsell}
              onOpenChange={setShowCoffeePremiumUpsell}
            />
          </>
        )}
      </div>
    );
  }

  // Session complete screen
  if (sessionMode === 'session_complete') {
    const masteredCount = beats.filter(b => b.is_mastered).length;
    const totalBeats = beats.length;
    const allMastered = masteredCount === totalBeats;

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <Medal className="h-20 w-20 text-primary animate-pulse" />
        <h2 className="text-2xl font-bold">
          {allMastered 
            ? t('beat_practice.all_completed', "All beats completed!")
            : t('beat_practice.session_complete', "Session Complete!")}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {allMastered 
            ? t('beat_practice.all_completed_desc', "Great work! Practice again later to reinforce your memory.")
            : masteredCount === 0
              ? t('beat_practice.no_beats_yet', { total: totalBeats, defaultValue: `You have ${totalBeats} beats to learn. Complete all phases of a beat to mark it as mastered!` })
              : t('beat_practice.come_back', { current: masteredCount, total: totalBeats, defaultValue: `You've mastered ${masteredCount}/${totalBeats} beats. Come back in a few hours to learn the next one!` })}
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('beat_practice.science_tip', "Sleep strengthens memories more than repetition")}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t('beat_practice.morning_tip', "Morning recall = memory consolidation boost")}
          </p>
        </div>
        <Button onClick={onComplete || onExit} className="mt-6">
          {t('common.done', 'Done')}
        </Button>
      </div>
    );
  }

  if (!currentBeat) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No beats found</p>
        <Button onClick={onExit} className="mt-4">
          {t('common.back')}
        </Button>
      </div>
    );
  }

  // Get progress info based on mode
  const getProgressInfo = () => {
    if (sessionMode === 'recall') {
      return {
        label: t('beat_practice.recall_mode', 'Quick Recall'),
        sublabel: `Recall ${recallIndex + 1} of ${beatsToRecall.length}`,
      };
    }
    if (sessionMode === 'pre_beat_recall') {
      return {
        label: t('beat_practice.pre_beat_recall_mode', 'Recall Time'),
        sublabel: t('beat_practice.recall_before_next', 'Recall before next beat'),
      };
    }
    return {
      label: t('beat_practice.learn_mode', 'Learning New Beat'),
      sublabel: `Beat ${currentBeatIndex + 1}/${beats.length}`,
    };
  };

  const progressInfo = getProgressInfo();

  return (
    <div className="flex flex-col h-full bg-background">
      <PauseCountdownOverlay
        remainingSeconds={activePause?.remainingSeconds ?? null}
        totalSeconds={activePause?.totalSeconds ?? 1}
      />
      {/* Duolingo-style header with progress */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border/30" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          {/* Exit button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              stopListening();
              await saveCheckpoint();
              onExit?.();
            }}
            className="shrink-0 rounded-full hover:bg-muted"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          {/* Edit script — exits the session and opens the inline edit dialog */}
          {onEditScript && !showCelebration && subscriptionTier !== 'free' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                stopListening();
                await saveCheckpoint();
                onEditScript();
              }}
              className="shrink-0 rounded-full hover:bg-muted"
              title={t('practice.editScriptTitle', 'Redigera manus')}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
          {/* Full Speech Button */}
          {fullSpeechText && (
            <Sheet open={showFullSpeechModal} onOpenChange={setShowFullSpeechModal}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 rounded-full hover:bg-muted">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>{t('beat_practice.full_speech', 'Full Speech')}</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(80vh-80px)] mt-4">
                  <p className="text-base leading-relaxed whitespace-pre-wrap pr-4">
                    {fullSpeechText}
                  </p>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
          
          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  sessionMode === 'recall' ? "bg-amber-500" : sessionMode === 'pre_beat_recall' ? "bg-purple-500" : "bg-primary"
                )}
                style={{ 
                  width: `${sessionMode === 'recall' 
                    ? ((recallIndex + 1) / Math.max(beatsToRecall.length, 1)) * 100 
                    : sessionMode === 'pre_beat_recall'
                      ? ((hiddenWordIndices.size / Math.max(words.length, 1)) * 100)
                      : phase.includes('beat') 
                        ? 100 
                        : (getCurrentSentenceNumber() / 3) * 100}%` 
                }}
              />
            </div>
          </div>
          
          {/* Session badge */}
          {sessionMode === 'recall' ? (
            <div className={cn(
              "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border",
              is10MinRecall 
                ? "bg-orange-500/20 border-orange-500/40" 
                : "bg-amber-500/20 border-amber-500/40"
            )}>
              <span className={cn(
                "text-xs font-bold uppercase tracking-wide",
                is10MinRecall ? "text-orange-500" : "text-amber-500"
              )}>
                {isMergedRecall ? "Full Speech" : (is10MinRecall && !newBeatToLearn) ? "10min" : "Recall"}
              </span>
              <span className={cn(
                "text-sm font-bold",
                is10MinRecall ? "text-orange-400" : "text-amber-400"
              )}>
                {recallIndex + 1}/{beatsToRecall.length}
              </span>
            </div>
          ) : sessionMode === 'pre_beat_recall' ? (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40">
              <span className="text-xs font-bold text-purple-500 uppercase tracking-wide">Recall Time</span>
            </div>
          ) : (
            <div className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-semibold",
              "bg-primary/20 text-primary"
            )}>
              {progressInfo.sublabel}
            </div>
          )}
        </div>
      </div>

      {/* Main content area - scrollable when text overflows */}
      <div
        className="flex-1 overflow-y-auto px-4 py-6"
        onTouchStart={(e) => {
          const t0 = e.touches[0];
          (e.currentTarget as any)._swipeStart = { x: t0.clientX, y: t0.clientY, t: Date.now(), st: (e.currentTarget as HTMLDivElement).scrollTop };
        }}
        onTouchEnd={(e) => {
          const start = (e.currentTarget as any)._swipeStart as { x: number; y: number; t: number; st: number } | undefined;
          if (!start) return;
          (e.currentTarget as any)._swipeStart = undefined;
          const t1 = e.changedTouches[0];
          const dx = t1.clientX - start.x;
          const dy = t1.clientY - start.y;
          const dt = Date.now() - start.t;
          // Swipe down at top of scroll, or two-finger style horizontal back swipe → restart
          const isSwipeDown = dy > 110 && Math.abs(dx) < 60 && dt < 700 && start.st <= 4;
          const isSwipeRight = dx > 130 && Math.abs(dy) < 50 && dt < 600;
          if ((isSwipeDown || isSwipeRight) && !showCelebration) {
            restartCurrentBeatRef.current?.('swipe');
          }
        }}
      >
        <div className="w-full max-w-2xl mx-auto space-y-6 min-h-full flex flex-col justify-center">
          {isRecording && !isSpeechReady && !showCelebration && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary ring-1 ring-primary/20">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {t('beat_practice.listening_starting', 'Preparing microphone...')}
              </span>
            </motion.div>
          )}
          {isRecording && isSpeechReady && !showCelebration && (
            <span className="sr-only" aria-live="polite">
              {t('beat_practice.listening_ready', 'Listening')}
            </span>
          )}
          
          {/* Sentence dots (only in learn mode, show only unique sentences) */}
          {sessionMode === 'learn' && !phase.includes('beat') && (() => {
            const uniqueCount = currentBeat ? getUniqueSentences(currentBeat).length : 3;
            // Don't show dots for single sentence beats
            if (uniqueCount <= 1) return null;
            
            return (
              <div className="flex items-center justify-center gap-3">
                {Array.from({ length: uniqueCount }, (_, i) => i + 1).map((sentenceNum) => {
                  const currentSentence = getCurrentSentenceNumber();
                  const isComplete = sentenceNum < currentSentence;
                  const isCurrent = sentenceNum === currentSentence;
                  return (
                    <div
                      key={sentenceNum}
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                        isComplete && "bg-primary text-primary-foreground",
                        isCurrent && "bg-primary/20 text-primary ring-2 ring-primary",
                        !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : sentenceNum}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          
          {/* Beat phase indicator - show progress towards mastery */}
          {sessionMode === 'learn' && (
            <div className="flex justify-center mb-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {(() => {
                  const uniqueCount = currentBeat ? getUniqueSentences(currentBeat).length : 3;
                  // Calculate phase progress: S1 → S2 → S1+S2 → S3 → Full beat → Mastered
                  const phases = uniqueCount === 1 
                    ? ['sentence_1', 'beat', 'mastered']
                    : uniqueCount === 2
                      ? ['sentence_1', 'sentence_2', 'beat', 'mastered']
                      : ['sentence_1', 'sentence_2', 'sentence_3', 'beat', 'mastered'];
                  
                  const currentPhaseKey = phase.includes('beat') ? 'beat' : phase.split('_').slice(0, 2).join('_');
                  const currentIdx = phases.indexOf(currentPhaseKey);
                  
                  return phases.map((p, idx) => (
                    <div 
                      key={p} 
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        idx < currentIdx ? "bg-primary" : 
                        idx === currentIdx ? "bg-primary/50 ring-1 ring-primary" : 
                        "bg-muted"
                      )}
                      title={p === 'mastered' ? 'Beat mastered' : p === 'beat' ? 'Full beat' : `Sentence ${p.split('_')[1]}`}
                    />
                  ));
                })()}
                <span className="ml-2">{phase.includes('beat') ? t('beat_practice.final_phase', 'Final phase!') : ''}</span>
              </div>
            </div>
          )}

          {/* Phase pill */}
          <div className="flex justify-center items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              sessionMode === 'pre_beat_recall' && "bg-purple-500/10 text-purple-500",
              sessionMode !== 'pre_beat_recall' && getPhaseType() === 'learning' && "bg-blue-500/10 text-blue-500",
              sessionMode !== 'pre_beat_recall' && getPhaseType() === 'fading' && "bg-amber-500/10 text-amber-500",
              sessionMode !== 'pre_beat_recall' && getPhaseType() === 'combining' && "bg-purple-500/10 text-purple-500"
            )}>
              {sessionMode === 'pre_beat_recall' ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  {t('beat_practice.recall_previous', 'Recall previous beat')} · {words.length - hiddenWordIndices.size} words visible
                </>
              ) : getPhaseType() === 'learning' ? (
                <>
                  <Circle className="h-3 w-3 fill-current" />
                  Read aloud {repetitionCount}/{requiredLearningReps}
                </>
              ) : getPhaseType() === 'fading' ? (
                <>
                  <GraduationCap className="h-4 w-4" />
                  {words.length - hiddenWordIndices.size} words visible
                </>
              ) : (
                'Combining sentences'
              )}
            </span>
            {sessionMode !== 'pre_beat_recall' && sessionMode !== 'recall' && hiddenWordIndices.size < words.length && (
              <button
                type="button"
                onClick={jumpHideAhead}
                disabled={showCelebration}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                aria-label={t('beat_practice.skip_hide_ahead', 'Skip ahead')}
                title={t('beat_practice.skip_hide_ahead_tooltip', 'Hide more words now')}
              >
                <FastForward className="h-3.5 w-3.5" />
                {t('beat_practice.skip_hide_ahead', 'Skip ahead')}
              </button>
            )}
            {(sessionMode === 'pre_beat_recall' || sessionMode === 'recall') && hiddenWordIndices.size < words.length && (
              <button
                type="button"
                onClick={jumpHideAllRecall}
                disabled={showCelebration}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                aria-label={t('beat_practice.recall_hide_all', 'Hide all & test')}
                title={t('beat_practice.recall_hide_all_tooltip', 'Hide every word — recite the whole beat from memory')}
              >
                <FastForward className="h-3.5 w-3.5" />
                {t('beat_practice.recall_hide_all', 'Hide all & test')}
              </button>
            )}
          </div>



          {/* Explanation for hidden words during recall */}
          {(sessionMode === 'recall' || sessionMode === 'pre_beat_recall') && hiddenWordIndices.size > 0 && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-xs text-muted-foreground/60 -mt-3"
            >
              {t('beat_practice.hidden_words_explanation', 'Common words are pre-hidden to test your recall')}
            </motion.p>
          )}

          {/* Main sentence card - clean and centered */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-lg p-6 md:p-10 relative z-10">
            <AnimatePresence mode="wait">
              {showCelebration ? (
                <motion.div
                  key="celebration"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex flex-col items-center gap-6 py-8"
                >
                  <Sparkles className="h-16 w-16 text-primary animate-pulse" />
                  <p className="text-2xl font-bold text-primary text-center">{celebrationMessage}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="sentence"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full flex flex-col items-center"
                >
                  <SentenceDisplay
                    text={currentText}
                    hiddenWordIndices={hiddenWordIndices}
                    currentWordIndex={currentWordIndex}
                    spokenIndices={spokenIndices}
                    hesitatedIndices={hesitatedIndices}
                    missedIndices={missedIndices}
                    onWordTap={(idx) => {
                      if (hiddenWordIndices.has(idx)) {
                        setHiddenWordIndices(prev => {
                          const next = new Set(prev);
                          next.delete(idx);
                          return next;
                        });
                      }
                    }}
                  />
                  
                  {/* "One more time!" indicator when 1 more recall needed - not shown for pre_beat_recall (only needs 1) */}
                  {(sessionMode === 'recall' || (sessionMode === 'learn' && phase.includes('fading'))) && 
                   hiddenWordIndices.size === words.length && 
                   ((sessionMode === 'recall' && recallSuccessCount === 1) || 
                    (sessionMode === 'learn' && consecutiveNoScriptSuccess === 1)) && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mt-4 flex items-center justify-center"
                    >
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                        <Sparkles className="h-4 w-4" />
                        {t('beat_practice.one_more_time', 'Great! One more to lock it in')}
                      </span>
                    </motion.div>
                  )}

                  {/* Progress indicator for fading/recall modes */}
                  {(sessionMode === 'recall' || sessionMode === 'pre_beat_recall' || phase.includes('fading')) && (
                    <div className="mt-8 flex items-center justify-center gap-3">
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90">
                          <circle
                            cx="24" cy="24" r="20"
                            fill="none"
                            stroke="hsl(var(--muted))"
                            strokeWidth="3"
                          />
                          <circle
                            cx="24" cy="24" r="20"
                            fill="none"
                            stroke={sessionMode === 'pre_beat_recall' ? "hsl(270, 70%, 60%)" : "hsl(var(--primary))"}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${(hiddenWordIndices.size / Math.max(words.length, 1)) * 126} 126`}
                            className="transition-all duration-300"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {Math.round((hiddenWordIndices.size / Math.max(words.length, 1)) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {hiddenWordIndices.size === words.length 
                          ? sessionMode === 'pre_beat_recall' 
                            ? t('beat_practice.recall_complete_almost', 'Perfect! Moving on...')
                            : t('beat_practice.from_memory', 'From memory')
                          : sessionMode === 'pre_beat_recall'
                            ? t('beat_practice.recall_in_progress', 'Recalling...')
                            : t('beat_practice.words_fading', 'Words fading')}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BeatPracticeView;
