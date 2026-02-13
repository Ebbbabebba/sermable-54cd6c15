import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, Sparkles, CheckCircle2, ChevronRight, GraduationCap, FileText, Medal, X, Circle, Coffee, Play, SkipForward, BookOpen, Eye } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import BeatProgress from "./BeatProgress";
import SentenceDisplay from "./SentenceDisplay";
import { motion, AnimatePresence } from "framer-motion";
import { useSoundEffects } from "@/hooks/useSoundEffects";

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
  goalDate: Date | null
): Date | null => {
  // Sessions 0-1 are handled by 10min/evening/morning recalls
  if (sessionNumber < 2) return null;
  
  const intervalIndex = Math.min(sessionNumber, SPACED_REPETITION_INTERVALS.length - 1);
  let intervalDays = SPACED_REPETITION_INTERVALS[intervalIndex];
  
  // Compress intervals if deadline is close
  if (goalDate) {
    const now = new Date();
    const totalDaysRemaining = Math.max(1, Math.ceil((goalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate total remaining interval days from this session onwards
    let totalRemainingIntervals = 0;
    for (let i = intervalIndex; i < SPACED_REPETITION_INTERVALS.length; i++) {
      totalRemainingIntervals += SPACED_REPETITION_INTERVALS[i];
    }
    
    // If remaining intervals exceed remaining days, compress proportionally
    if (totalRemainingIntervals > 0 && totalDaysRemaining < totalRemainingIntervals) {
      const compressionRatio = totalDaysRemaining / totalRemainingIntervals;
      intervalDays = Math.max(1, Math.round(intervalDays * compressionRatio));
    }
  }
  
  if (intervalDays <= 0) return null;
  
  const nextDate = new Date(lastRecallAt);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  nextDate.setHours(8, 0, 0, 0); // Schedule at 8 AM
  return nextDate;
};

interface BeatPracticeViewProps {
  speechId: string;
  subscriptionTier?: 'free' | 'student' | 'regular' | 'enterprise';
  fullSpeechText?: string; // Full speech text for "Show Whole Speech" modal
  onComplete?: () => void;
  onExit?: () => void;
  onSessionLimitReached?: () => void; // Called when free user hits daily limit
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

// Gap/filler words that are ALWAYS hidden from the start (EN + SV)
const COMMON_WORDS = new Set([
  // English
  'the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with',
  'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'or', 'but', 'so', 'if', 'not', 'no', 'yes', 'up', 'out', 'from',
  // Swedish
  'och', 'i', 'på', 'att', 'en', 'ett', 'av', 'för', 'med', 'som', 'är', 'var',
  'den', 'det', 'de', 'om', 'till', 'från', 'har', 'kan', 'ska', 'vill',
  'men', 'eller', 'så', 'när', 'där', 'här', 'inte', 'bara', 'även', 'också',
  'vi', 'jag', 'du', 'han', 'hon', 'ni', 'sin', 'sitt', 'sina',
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

const BeatPracticeView = ({ speechId, subscriptionTier = 'free', fullSpeechText, onComplete, onExit, onSessionLimitReached }: BeatPracticeViewProps) => {
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
  const [familiarityLevel, setFamiliarityLevel] = useState<'beginner' | 'intermediate' | 'confident'>('beginner');
  
  // Calculate words to hide per successful repetition based on familiarity
  const wordsToHidePerSuccess = familiarityLevel === 'confident' ? 3 : familiarityLevel === 'intermediate' ? 2 : 1;
  // Only 1 read-through required before fading begins
  const requiredLearningReps = 1;
  
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
  
  // Rest between beats state
  const [restUntilTime, setRestUntilTime] = useState<Date | null>(null);
  const [restMinutes, setRestMinutes] = useState(0);
  const [nextBeatQueued, setNextBeatQueued] = useState<Beat | null>(null);
  
  // Pre-beat recall state - recall the just-mastered beat before starting a new one
  const [beatToRecallBeforeNext, setBeatToRecallBeforeNext] = useState<Beat | null>(null);
  const [preBeatRecallSuccessCount, setPreBeatRecallSuccessCount] = useState(0);
  
  // Phase tracking
  const [phase, setPhase] = useState<Phase>('sentence_1_learning');
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
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const { toast } = useToast();
  
  // Transcription using Web Speech API
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const transcriptWordsRef = useRef<string[]>([]);
  const runningTranscriptRef = useRef<string>("");
  const lastWordTimeRef = useRef<number>(Date.now());
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Guards against duplicate "sentence complete" triggers for the same repetition
  const lastCompletionRepIdRef = useRef<number>(-1);

  // Ignore speech results briefly right after we reset / during transitions
  const ignoreResultsUntilRef = useRef(0);

  // When we intentionally abort recognition (to flush stale results), don't restart until this time
  const recognitionRestartAtRef = useRef(0);
  const recognitionRestartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the repetition number so we can ignore old transcript data after reset
  const repetitionIdRef = useRef(0);

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
    (transcript: string, isFinal: boolean, repId: number) => void
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

  // Get current sentence text based on phase
  const getCurrentText = useCallback(() => {
    if (!currentBeat) return "";
    
    const uniqueSentences = getUniqueSentences(currentBeat);
    const uniqueCount = uniqueSentences.length;
    
    // For short speeches with only 1 unique sentence, always show that sentence
    if (uniqueCount === 1) {
      return uniqueSentences[0];
    }
    
    // For 2 unique sentences
    if (uniqueCount === 2) {
      // In recall mode or beat phases, show both sentences
      if (sessionMode === 'recall' || phase === 'beat_learning' || phase === 'beat_fading') {
        return uniqueSentences.join(' ');
      }
      // Sentence 1 phases
      if (phase.startsWith('sentence_1')) return uniqueSentences[0];
      // Sentence 2 phases or combining phases
      if (phase.startsWith('sentence_2') || phase.startsWith('sentences_1_2')) {
        return uniqueSentences.join(' ');
      }
      // Sentence 3 phases - for 2 sentences, skip to full beat
      if (phase.startsWith('sentence_3')) return uniqueSentences.join(' ');
      return uniqueSentences.join(' ');
    }
    
    // For 3 unique sentences (normal case)
    if (sessionMode === 'recall') {
      return uniqueSentences.join(' ');
    }
    
    if (phase === 'beat_learning' || phase === 'beat_fading') {
      return uniqueSentences.join(' ');
    }
    
    if (phase === 'sentences_1_2_learning' || phase === 'sentences_1_2_fading') {
      return `${uniqueSentences[0]} ${uniqueSentences[1]}`;
    }
    
    if (phase.startsWith('sentence_1')) return uniqueSentences[0];
    if (phase.startsWith('sentence_2')) return uniqueSentences[1];
    if (phase.startsWith('sentence_3')) return uniqueSentences[2] || uniqueSentences[1];
    
    return "";
  }, [currentBeat, phase, sessionMode, getUniqueSentences]);

  const currentText = getCurrentText();
  const words = useMemo(() => currentText.split(/\s+/).filter(w => w.trim()), [currentText]);

  // Identify which word indices are "first word of a sentence"
  // These should never turn yellow (hesitated) due to natural pause between sentences
  const sentenceStartIndices = new Set<number>();
  sentenceStartIndices.add(0); // First word of entire text is always a sentence start
  for (let i = 0; i < words.length - 1; i++) {
    // If current word ends with sentence-ending punctuation, next word is sentence start
    if (/[.!?]$/.test(words[i])) {
      sentenceStartIndices.add(i + 1);
    }
  }
  const sentenceStartIndicesRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    sentenceStartIndicesRef.current = sentenceStartIndices;
  }, [currentText]);

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

  // Hard-stop + delay restart to prevent Web Speech from replaying buffered results
  const pauseSpeechRecognition = (pauseMs: number) => {
    const until = Date.now() + pauseMs;

    ignoreResultsUntilRef.current = Math.max(ignoreResultsUntilRef.current, until);
    recognitionRestartAtRef.current = Math.max(recognitionRestartAtRef.current, until);

    runningTranscriptRef.current = "";
    transcriptRef.current = "";
    transcriptWordsRef.current = [];

    if (recognitionRef.current && typeof recognitionRef.current.abort === "function") {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }
  };

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
      .select('speech_language, last_practice_session_at, goal_date, familiarity_level')
      .eq('id', speechId)
      .single();

    if (speechRow?.speech_language) {
      setSpeechLang(speechRow.speech_language);
    }
    
    // Set familiarity level for adaptive word hiding
    if (speechRow?.familiarity_level) {
      setFamiliarityLevel(speechRow.familiarity_level as 'beginner' | 'intermediate' | 'confident');
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
      
      // Find mastered beats that need 10-minute recall (recall_10min_at is in the past and not yet recalled)
      const beatsNeeding10MinRecall = rows.filter(b => {
        if (!b.is_mastered || !b.recall_10min_at) return false;
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
      const masteredBeats = rows.filter(b => b.is_mastered && b.mastered_at);
      const beatsNeedingDailyRecall = todayIsNewDay 
        ? masteredBeats.filter(b => {
            // Skip if already in any recall queue
            if (beatsNeeding10MinRecall.some(r => r.id === b.id)) return false;
            if (beatsNeedingEveningRecall.some(r => r.id === b.id)) return false;
            if (beatsNeedingMorningRecall.some(r => r.id === b.id)) return false;
            // Need recall if: never recalled today
            if (!b.last_recall_at) return true;
            const lastRecall = new Date(b.last_recall_at);
            return lastRecall.toDateString() !== new Date().toDateString();
          })
        : [];
      
      // Find mastered beats that need scheduled 2/3/5/7 recall (next_scheduled_recall_at is in the past)
      const beatsNeedingScheduledRecall = masteredBeats.filter(b => {
        if (!b.next_scheduled_recall_at) return false;
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
      
      console.log('📚 Beat selection:', {
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
          } else {
            // First beat ever - go directly to beat preview
            setSessionMode('beat_preview');
            setCurrentBeatIndex(rows.findIndex(b => b.id === firstUnmastered.id));
          }
        }
      } else if (masteredBeats.length > 0) {
        // All beats completed - start a recall/practice session on the first beat
        console.log('🔄 All beats completed - starting recall practice on first beat');
        const beatToRecall = masteredBeats.sort((a, b) => a.beat_order - b.beat_order)[0];
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
        const clean = w.toLowerCase().replace(/[^\p{L}]/gu, '');
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
    
    // If there are non-protected words to hide, use those first
    if (nonProtectedVisible.length > 0) {
      // Priority 1: Common articles/prepositions
      for (const idx of nonProtectedVisible) {
        const word = words[idx].toLowerCase().replace(/[^a-z]/g, '');
        if (COMMON_WORDS.has(word)) return idx;
      }
      
      // Priority 2: Short words (2-4 chars)
      for (const idx of nonProtectedVisible) {
        const word = words[idx].replace(/[^a-zA-Z]/g, '');
        if (word.length >= 2 && word.length <= 4) return idx;
      }
      
      // Priority 3: Middle words (not first or last)
      const middleIndices = nonProtectedVisible.filter(i => i > 0 && i < words.length - 1);
      if (middleIndices.length > 0) return middleIndices[0];
      
      // Priority 4: First visible non-protected word
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

  // Check if spoken word matches expected - STRICT matching
  // More lenient matching for visible words and lenient words (proper nouns), stricter for regular hidden words
  const wordsMatch = (spoken: string, expected: string, isHidden: boolean = false, isLenient: boolean = false): boolean => {
    const s = normalizeWord(spoken);
    const e = normalizeWord(expected);
    
    // Debug logging for troubleshooting
    if (isHidden && !isLenient) {
      console.log(`🎯 Hidden word match: spoken="${s}" expected="${e}" exact=${s === e}`);
    }
    
    // Exact match - always pass
    if (s === e) return true;
    
    // Empty after normalization
    if (!s || !e) return false;
    
    // For LENIENT words (proper nouns/names), use visible word matching rules
    // These are hidden but we expect speech recognition to struggle with them
    if (isLenient) {
      // VERY lenient matching for names/proper nouns - speech recognition often 
      // produces completely different text for names like "Ebba Hallert Djurberg"
      if (e.length <= 2) return s === e; // Too short, need exact
      
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
    
    // For HIDDEN words (non-lenient), be stricter - need to prove they know it
    if (isHidden) {
      // 1-2 char words require exact match
      if (e.length <= 2) return false;
      
      // 3-char words: allow 1 character difference (speech recognition variance)
      if (e.length === 3) {
        if (Math.abs(s.length - e.length) > 1) return false;
        let diff = 0;
        const maxLen = Math.max(s.length, e.length);
        for (let i = 0; i < maxLen; i++) {
          if (s[i] !== e[i]) diff++;
        }
        return diff <= 1;
      }
      
      // 4+ char words: allow 1 char difference, similar length
      if (Math.abs(s.length - e.length) > 1) return false;
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
        if (diff > 1) return false;
      }
      return true;
    }
    
    // For VISIBLE words, slightly more lenient than hidden but still meaningful
    // Short words (1-2 chars): require exact
    if (e.length <= 2) return false;
    
    // 3-char words: allow 1 difference
    if (e.length === 3) {
      if (Math.abs(s.length - e.length) > 1) return false;
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
      }
      return diff <= 1;
    }
    
    // 4+ char words: use Levenshtein with slightly more tolerance than hidden
    // Don't match if lengths are too different
    if (Math.abs(s.length - e.length) > 2) return false;
    
    // Must share first letter (same starting sound)
    if (s[0] !== e[0]) return false;
    
    // Allow 1 char diff for 4-6 letter words, 2 for 7-10, 3 for 11+
    const maxDist = e.length <= 6 ? 1 : e.length <= 10 ? 2 : 3;
    let diff = 0;
    for (let i = 0; i < Math.max(s.length, e.length); i++) {
      if (s[i] !== e[i]) diff++;
      if (diff > maxDist) return false;
    }
    return true;
  };

  // Process transcription - cursor-based
  const processTranscription = useCallback((transcript: string, isFinal: boolean, repId: number) => {
    if (repId !== repetitionIdRef.current) return;
    
    const rawWords = transcript.split(/\s+/).filter((w) => w.trim());
    if (rawWords.length === 0) return;

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
        if (rawWords[rawWords.length - i] !== prevWords[prevCount - i]) {
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
    transcriptWordsRef.current = rawWords;

    const newWords = rawWords.slice(startIdx);

    // If no words to process, nothing to do
    if (newWords.length === 0) return;
    
    let advancedTo = currentIdx;
    const newSpoken = new Set(spokenIndicesRef.current);
    const newMissed = new Set(missedIndicesRef.current);

    for (const spoken of newWords) {
      if (advancedTo >= words.length) break;

      // Check if current word is hidden (needs stricter matching) and if it's lenient (proper noun/name)
      const currentIsHidden = hiddenWordIndicesRef.current.has(advancedTo);
      const currentIsLenient = lenientWordIndicesRef.current.has(advancedTo);
      
      // STRICT: Only match the CURRENT word position - no lookahead
      // This prevents jumping to a duplicate word further in the sentence
      let foundIdx = -1;
      if (wordsMatch(spoken, words[advancedTo], currentIsHidden, currentIsLenient)) {
        foundIdx = advancedTo;
      }

      if (foundIdx === -1) {
        // Current word didn't match - check NEXT word (lookahead of 1)
        // This handles minor recognition order issues without jumping too far
        const nextIsHidden = hiddenWordIndicesRef.current.has(advancedTo + 1);
        const nextIsLenient = lenientWordIndicesRef.current.has(advancedTo + 1);
        if (advancedTo + 1 < words.length && wordsMatch(spoken, words[advancedTo + 1], nextIsHidden, nextIsLenient)) {
          // Mark current word as passed
          if (currentIsHidden) {
            // Hidden word was skipped - but check if it's a lenient word (proper noun/name)
            // Lenient words don't turn red - they're hidden but treated like visible words
            if (!currentIsLenient) {
              newMissed.add(advancedTo);
            }
          }
          // Always mark current word as spoken (visible words just move on)
          newSpoken.add(advancedTo);
          foundIdx = advancedTo + 1;
        } else if ((!currentIsHidden || currentIsLenient) && advancedTo + 2 < words.length) {
          // If current word is VISIBLE or LENIENT and we're stuck, check 2 words ahead
          // This helps when recognition completely misses a visible/lenient word
          const twoAheadIsHidden = hiddenWordIndicesRef.current.has(advancedTo + 2);
          const twoAheadIsLenient = lenientWordIndicesRef.current.has(advancedTo + 2);
          if (wordsMatch(spoken, words[advancedTo + 2], twoAheadIsHidden, twoAheadIsLenient)) {
            // Skip current visible/lenient word and the next one (if also visible/lenient)
            newSpoken.add(advancedTo);
            const nextIdx = advancedTo + 1;
            const nextIsHiddenCheck = hiddenWordIndicesRef.current.has(nextIdx);
            const nextIdxIsLenient = lenientWordIndicesRef.current.has(nextIdx);
            if (!nextIsHiddenCheck || nextIdxIsLenient) {
              // Visible or lenient - just move on
              newSpoken.add(nextIdx);
            } else {
              // Hidden and not lenient - mark as missed
              newMissed.add(nextIdx);
            }
            foundIdx = advancedTo + 2;
          }
        }
      }

      if (foundIdx === -1) {
        // Still no match - this spoken word doesn't match expected sequence
        // Just skip it (could be filler word, cough, background noise, etc.)
        continue;
      }

      // Found a match at current position or nearby - mark all words up to match as spoken
      // If we're jumping ahead (foundIdx > advancedTo), mark skipped hidden words as missed
      // BUT: lenient words (proper nouns/names) can't turn red - they just move on
      for (let j = advancedTo; j < foundIdx; j++) {
        const isHidden = hiddenWordIndicesRef.current.has(j);
        const isLenient = lenientWordIndicesRef.current.has(j);
        if (isHidden && !isLenient) {
          newMissed.add(j);
        }
        newSpoken.add(j);
      }
      newSpoken.add(foundIdx);
      
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
      lastWordTimeRef.current = Date.now();
    }

    if (advancedTo >= words.length) {
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
        setCelebrationMessage(`${currentRep}/${requiredLearningReps} ✓`);
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
      // Failed recall - reveal ONLY the words that were missed/hesitated, but still hide 3 new words
      // Reset success count back to 0 (next success will hide 3 words again)
      setRecallSuccessCount(0);
      
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
      
      // Still hide 3 NEW words (base amount) even on failure
      const wordsToHideOnFailure = 3;
      for (let i = 0; i < wordsToHideOnFailure; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null && !failedIndices.has(nextToHide)) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        }
      }
      
      setCelebrationMessage("🔄 Try again");
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
      setCelebrationMessage(`✓ ${visibleCount} words left`);
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
          const newSessionNum = currentSessionNum + 1;
          const nextRecallDate = calculateNextRecallDate(newSessionNum, new Date(), goalDate);
          
          const updateData: Record<string, any> = { 
            last_recall_at: new Date().toISOString(),
            recall_session_number: newSessionNum,
          };
          if (nextRecallDate) {
            updateData.next_scheduled_recall_at = nextRecallDate.toISOString();
          }
          
          supabase
            .from('practice_beats')
            .update(updateData)
            .eq('id', recalledBeat.id)
            .then(() => {
              console.log(`📅 Beat ${recalledBeat.beat_order} recall session ${newSessionNum}, next scheduled:`, nextRecallDate?.toISOString() ?? 'none');
            });
        }
        
        // If this was a merged recall, update last_merged_recall_at for all merged beats
        if (isMergedRecall && mergedRecallBeats.length > 0) {
          const now = new Date().toISOString();
          for (const mb of mergedRecallBeats) {
            supabase
              .from('practice_beats')
              .update({ last_merged_recall_at: now })
              .eq('id', mb.id)
              .then(() => {});
          }
          console.log(`🔗 Merged recall completed for ${mergedRecallBeats.length} beats`);
        }

        setCelebrationMessage(isMergedRecall ? "✅ Full recall complete!" : "✅ Beat recalled!");
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
              console.log('🔗 Starting merged recall of', mergedRecallBeats.length, 'beats');
              // Create a synthetic "merged beat" that combines all mastered beats' text
              const mergedBeat: Beat = {
                id: 'merged-recall',
                beat_order: -1,
                sentence_1_text: mergedRecallBeats.map(b => b.sentence_1_text).join(' '),
                sentence_2_text: mergedRecallBeats.map(b => b.sentence_2_text).join(' '),
                sentence_3_text: mergedRecallBeats.map(b => b.sentence_3_text).join(' '),
                is_mastered: true,
                mastered_at: null,
                last_recall_at: null,
                recall_10min_at: null,
                recall_evening_at: null,
                recall_morning_at: null,
              };
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
        setCelebrationMessage(`${newCount}/2 perfect recalls ✓`);
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
      // Failed - reveal failed words, reset progress, try again
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
      
      // Still hide 3 new words even on failure (base amount)
      for (let i = 0; i < 3; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null && !failedIndices.has(nextToHide)) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        }
      }
      
      setCelebrationMessage("🔄 Try again");
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
      setCelebrationMessage(`✓ ${visibleCount} words left`);
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        setHiddenWordIndices(newHidden);
        setHiddenWordOrder(newOrder);
        resetForNextRep();
      }, 800);
    } else {
      // All hidden and success! Pre-beat recall complete - now show the new beat preview
      setCelebrationMessage("✅ " + t('beat_practice.recall_complete', "Ready for next beat!"));
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
  // Key behavior: ALWAYS continue hiding words, even on errors
  // Failed words stay visible and become "protected" - they disappear LAST
  function handleFadingCompletion(hadErrors: boolean, failedSet: Set<number>) {
    const allHidden = hiddenWordIndices.size >= words.length;

    // Always hide words progressively, even with errors
    if (!allHidden) {
      // On error: still hide 3 words (base amount). On success: progressive 3 → 4 → 5
      const wordsToHide = hadErrors ? 3 : Math.min(3 + fadingSuccessCount, 5);
      
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
      } else {
        setFadingSuccessCount(prev => Math.min(prev + 1, 2)); // Cap at 2 (so max = 5)
      }
      
      // ALWAYS hide more words (continue progression even on failure)
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

  const resetForNextRep = () => {
    repetitionIdRef.current += 1;
    ignoreResultsUntilRef.current = Date.now() + 400;

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
    lastWordTimeRef.current = Date.now();
  };

  const transitionToPhase = (newPhase: Phase) => {
    setPhase(newPhase);
    setRepetitionCount(1);
    repetitionCountRef.current = 1;
    setHiddenWordIndices(new Set());
    setHiddenWordOrder([]);
    setProtectedWordIndices(new Set()); // Clear protected words for new phase
    setConsecutiveNoScriptSuccess(0);
    setFadingSuccessCount(0); // Reset progressive hiding for new phase

    lastCompletionRepIdRef.current = -1;
    pauseSpeechRecognition(900);
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
      message = t('beat_practice.lets_combine', "🔗 Let's combine them!");
    } else if (currentPhase === 'sentence_3_fading') {
      message = t('beat_practice.final_combine', "🚀 Now all together!");
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
          // 2 sentences - skip sentence 3 phases
          if (currentPhase === 'sentence_1_fading') {
            transitionToPhase('sentence_2_learning');
          } else if (currentPhase === 'sentence_2_fading' || currentPhase === 'sentences_1_2_fading') {
            transitionToPhase('beat_learning');
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
      if (now.getHours() >= 18) {
        // Mastered after 6 PM - schedule 2 hours from now
        recallEveningAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      } else if (now.getHours() >= 20) {
        // Already past 8 PM - schedule for tomorrow morning instead (skip evening)
        recallEveningAt = eveningTarget; // Will be in the past, won't trigger
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
      
      // Update schedule's next_review_date based on spaced repetition
      // For beat-based learning: next review in 4-24 hours depending on deadline
      const hoursUntilNextReview = daysUntilDeadline <= 1 ? 4 : daysUntilDeadline <= 3 ? 8 : daysUntilDeadline <= 7 ? 12 : 24;
      const nextReviewDate = new Date(Date.now() + hoursUntilNextReview * 60 * 60 * 1000);
      
      // Update or insert schedule for this speech
      const { data: existingSchedule } = await supabase
        .from('schedules')
        .select('id')
        .eq('speech_id', speechId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingSchedule) {
        await supabase
          .from('schedules')
          .update({ 
            next_review_date: nextReviewDate.toISOString(),
            last_reviewed_at: new Date().toISOString(),
          })
          .eq('id', existingSchedule.id);
      } else {
        await supabase
          .from('schedules')
          .insert({
            speech_id: speechId,
            session_date: new Date().toISOString().split('T')[0],
            next_review_date: nextReviewDate.toISOString(),
            last_reviewed_at: new Date().toISOString(),
            completed: true,
          });
      }
      
      // Also update the speech's next_review_date directly
      await supabase
        .from('speeches')
        .update({ next_review_date: nextReviewDate.toISOString() })
        .eq('id', speechId);
      
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
        // Store the just-mastered beat for recall after rest
        const justMasteredBeat = currentBeat;
        const restMins = calculateRestMinutes(daysUntilDeadline);
        setRestMinutes(restMins);
        setRestUntilTime(new Date(Date.now() + restMins * 60 * 1000));
        setNextBeatQueued(nextUnmastered);
        setBeatToRecallBeforeNext(justMasteredBeat); // Save for recall after rest
        
        setCelebrationMessage("🏆 " + t('beat_practice.beat_complete_rest', "Beat complete! Take a short break."));
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          setSessionMode('beat_rest');
        }, 2000);
      } else {
        // Session ending: show coffee break with 10-min timer, then recall
        setCelebrationMessage("🏆 " + t('beat_practice.beat_complete', "Beat complete! Coffee break time."));
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
            setSessionMode('coffee_break');
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

  // Start recording using Web Speech API
  const startRecording = async () => {
    if (recognitionRef.current) return;

    resetForNextRep();
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast({
          variant: "destructive",
          title: "Not Supported",
          description: "Speech recognition is not supported in this browser. Try Chrome or Safari.",
        });
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getRecognitionLocale(speechLang);
      console.log('🗣️ Speech recognition language:', recognition.lang);

      runningTranscriptRef.current = "";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (showCelebrationRef.current) return;
        if (Date.now() < ignoreResultsUntilRef.current) return;

        const currentRepId = repetitionIdRef.current;

        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const chunk = res?.[0]?.transcript ?? "";

          if (res.isFinal) {
            runningTranscriptRef.current += chunk + " ";
          } else {
            interim += chunk + " ";
          }
        }

        const combined = (runningTranscriptRef.current + interim).trim();

        const lastIsFinal = event.results.length
          ? event.results[event.results.length - 1].isFinal
          : false;

        processTranscriptionRef.current(combined, lastIsFinal, currentRepId);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          toast({
            variant: "destructive",
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use speech recognition.",
          });
        }
      };
      
      recognition.onend = () => {
        if (!isRecordingRef.current) return;
        if (!recognitionRef.current) return;

        const startSafely = () => {
          if (!isRecordingRef.current) return;
          if (!recognitionRef.current) return;
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Recognition already started');
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
      recognition.start();

      lastWordTimeRef.current = Date.now();
      
      hesitationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastWordTimeRef.current;
        const idx = currentWordIndexRef.current;
        if (elapsed > 3000 && idx < wordsLengthRef.current) {
          // Skip hesitation marking for first word of any sentence (natural pause between sentences)
          if (sentenceStartIndicesRef.current.has(idx)) {
            return;
          }
          if (hiddenWordIndicesRef.current.has(idx)) {
            // Mark as hesitated if not already
            if (!hesitatedIndicesRef.current.has(idx)) {
              const newHesitated = new Set([...hesitatedIndicesRef.current, idx]);
              hesitatedIndicesRef.current = newHesitated;
              setHesitatedIndices(newHesitated);
            }
            
            // Auto-advance past stuck words to prevent freezing
            // Lenient words (names/proper nouns) get a faster timeout since speech recognition
            // consistently struggles with them (e.g. "Ebba Hallert Djurberg")
            const isLenientWord = lenientWordIndicesRef.current.has(idx);
            const autoAdvanceMs = isLenientWord ? 3000 : 6000;
            if (elapsed > autoAdvanceMs) {
              console.log(`⏭️ Auto-advancing past ${isLenientWord ? 'lenient' : 'hesitated'} word "${words[idx]}" at index ${idx} after ${autoAdvanceMs/1000}s timeout`);
              
              // Mark as spoken and move on
              const newSpoken = new Set([...spokenIndicesRef.current, idx]);
              spokenIndicesRef.current = newSpoken;
              setSpokenIndices(newSpoken);
              
              // Advance word index
              const nextIdx = idx + 1;
              currentWordIndexRef.current = nextIdx;
              setCurrentWordIndex(nextIdx);
              
              // Reset the timer for the next word
              lastWordTimeRef.current = Date.now();
            }
          }
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
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

    recognitionRestartAtRef.current = 0;
    if (recognitionRestartTimeoutRef.current) {
      clearTimeout(recognitionRestartTimeoutRef.current);
      recognitionRestartTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
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
        <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border/30">
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
              📚 {t('beat_practice.beat_number', { number: beatNumber, defaultValue: `Beat ${beatNumber}` })}
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

  // Rest screen between beats (for intensive mode)
  if (sessionMode === 'beat_rest' && restUntilTime) {
    const masteredCount = beats.filter(b => b.is_mastered).length;
    const totalBeats = beats.length;
    const beatsRemaining = totalBeats - masteredCount;
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Coffee className="h-20 w-20 text-amber-500" />
        </motion.div>
        
        <h2 className="text-2xl font-bold">
          {t('beat_practice.rest_title', "☕ Coffee Break!")}
        </h2>
        
        <p className="text-muted-foreground max-w-md">
          {t('beat_practice.rest_reason', "Take a 10-minute break to let your brain consolidate. After the break, you'll do a quick review of what you just learned.")}
        </p>
        
        {/* Countdown timer */}
        <RestCountdown 
          targetTime={restUntilTime} 
          onComplete={startNextBeat}
          restMinutes={restMinutes}
        />
        
        <div className="flex flex-col gap-2 mt-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            {t('beat_practice.rest_tip', "Tip: Take a short walk or grab a coffee!")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('beat_practice.rest_recall_info', "After the break: quick recall → then next beat")}
          </p>
        </div>
        
        <Button variant="ghost" onClick={startNextBeat} className="mt-4">
          <Play className="h-4 w-4 mr-2" />
          {t('beat_practice.skip_rest', "Start now anyway")}
        </Button>
      </div>
    );
  }

  // Coffee break screen - 10 min timer before recall
  if (sessionMode === 'coffee_break' && restUntilTime) {
    const startCoffeeBreakRecall = () => {
      setRestUntilTime(null);
      setRestMinutes(0);
      setIs10MinRecall(true);
      setRecallIndex(0);
      setRecallSuccessCount(0);
      setHiddenWordIndices(new Set());
      setHiddenWordOrder([]);
      setSessionMode('recall');
    };

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <Coffee className="h-24 w-24 text-amber-500" />
        </motion.div>
        
        <motion.h2 
          className="text-2xl font-bold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          ☕ {t('beat_practice.coffee_break_title', "Coffee Break!")}
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
            <GraduationCap className="h-4 w-4" />
            {t('beat_practice.coffee_tip', "Tip: Take a short walk or grab a coffee!")}
          </p>
          <p className="text-sm text-muted-foreground">
            🧠 {t('beat_practice.coffee_recall_info', "After the break: quick recall of what you just learned")}
          </p>
        </motion.div>
        
        <Button variant="ghost" onClick={startCoffeeBreakRecall} className="mt-4">
          <Play className="h-4 w-4 mr-2" />
          {t('beat_practice.skip_break', "Start recall now")}
        </Button>
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
            ? t('beat_practice.all_completed', "🎉 All beats completed!")
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
        label: t('beat_practice.recall_mode', '🔄 Quick Recall'),
        sublabel: `Recall ${recallIndex + 1} of ${beatsToRecall.length}`,
      };
    }
    if (sessionMode === 'pre_beat_recall') {
      return {
        label: t('beat_practice.pre_beat_recall_mode', '🧠 Recall Time'),
        sublabel: t('beat_practice.recall_before_next', 'Recall before next beat'),
      };
    }
    return {
      label: t('beat_practice.learn_mode', '📚 Learning New Beat'),
      sublabel: `Beat ${currentBeatIndex + 1}/${beats.length}`,
    };
  };

  const progressInfo = getProgressInfo();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Duolingo-style header with progress */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border/30">
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
          
          {/* Skip/Continue button - subtle, in header */}
          {!showCelebration && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playClick();
                const allIndices = new Set<number>(words.map((_, i) => i));
                pauseSpeechRecognition(900);
                checkCompletion(allIndices, failedWordIndices);
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              <span className="text-xs">{t('common.skip', 'Skip')}</span>
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
                {isMergedRecall ? "🔗 Full Speech" : is10MinRecall ? "⏰ 10min" : "🔄 Recall"}
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
              <span className="text-xs font-bold text-purple-500 uppercase tracking-wide">🧠 Recall Time</span>
            </div>
          ) : (
            <div className={cn(
              "shrink-0 px-3 py-1 rounded-full text-xs font-semibold",
              "bg-primary/20 text-primary"
            )}>
              📚 {progressInfo.sublabel}
            </div>
          )}
        </div>
      </div>

      {/* Main content area - scrollable when text overflows */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="w-full max-w-2xl mx-auto space-y-6 min-h-full flex flex-col justify-center">
          
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
          <div className="flex justify-center">
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
          </div>

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
                        {t('beat_practice.one_more_time', 'Great! One more to lock it in ✨')}
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
