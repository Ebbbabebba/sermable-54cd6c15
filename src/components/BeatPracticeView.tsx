import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, Sparkles, CheckCircle2, ChevronRight, GraduationCap, FileText, Medal, X, Circle, Coffee, Play, SkipForward } from "lucide-react";
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
  checkpoint_sentence?: number | null;
  checkpoint_phase?: string | null;
  checkpoint_hidden_indices?: number[] | null;
}

interface BeatPracticeViewProps {
  speechId: string;
  subscriptionTier?: 'free' | 'student' | 'regular' | 'enterprise';
  onComplete?: () => void;
  onExit?: () => void;
  onSessionLimitReached?: () => void; // Called when free user hits daily limit
}

type Phase = 'sentence_1_learning' | 'sentence_1_fading' | 'sentence_2_learning' | 'sentence_2_fading' | 'sentences_1_2_learning' | 'sentences_1_2_fading' | 'sentence_3_learning' | 'sentence_3_fading' | 'beat_learning' | 'beat_fading';

// Session modes: recall (quick review of mastered beats), learn (learning a new beat), beat_rest (pause between beats)
type SessionMode = 'recall' | 'learn' | 'beat_rest' | 'session_complete';

// Calculate rest minutes based on deadline urgency
const calculateRestMinutes = (daysUntilDeadline: number): number => {
  if (daysUntilDeadline <= 1) return 5;    // Very tight: 5 min
  if (daysUntilDeadline <= 3) return 10;   // Tight: 10 min
  return 15;                                // Normal: 15 min
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

// Common words to fade first
const COMMON_WORDS = new Set(['the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with', 'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']);

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

const BeatPracticeView = ({ speechId, subscriptionTier = 'free', onComplete, onExit, onSessionLimitReached }: BeatPracticeViewProps) => {
  const { t } = useTranslation();
  const isPremium = subscriptionTier !== 'free';
  
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
  // Calculate required learning repetitions based on familiarity
  const requiredLearningReps = familiarityLevel === 'confident' ? 2 : 3;
  
  // Session mode tracking
  const [sessionMode, setSessionMode] = useState<SessionMode>('recall');
  const [beatsToRecall, setBeatsToRecall] = useState<Beat[]>([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallSuccessCount, setRecallSuccessCount] = useState(0);
  const [newBeatToLearn, setNewBeatToLearn] = useState<Beat | null>(null);
  const [daysUntilDeadline, setDaysUntilDeadline] = useState(30);
  const [beatsPerDay, setBeatsPerDay] = useState(1);
  
  // Rest between beats state
  const [restUntilTime, setRestUntilTime] = useState<Date | null>(null);
  const [restMinutes, setRestMinutes] = useState(0);
  const [nextBeatQueued, setNextBeatQueued] = useState<Beat | null>(null);
  
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
  const [consecutiveNoScriptSuccess, setConsecutiveNoScriptSuccess] = useState(0); // Track 2 successful no-script reps
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  const { toast } = useToast();
  
  // Transcription using Web Speech API
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
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

  // Get current beat based on session mode
  const currentBeat = sessionMode === 'recall' 
    ? beatsToRecall[recallIndex] 
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
  const words = currentText.split(/\s+/).filter(w => w.trim());

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
  }, [words.length]);

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

    const setBeatsAndPlan = (rows: Beat[]) => {
      setBeats(rows);
      
      // Find mastered beats that need recall (only on new days)
      const masteredBeats = rows.filter(b => b.is_mastered && b.mastered_at);
      const beatsNeedingRecall = todayIsNewDay 
        ? masteredBeats.filter(b => {
            // Need recall if: never recalled today
            if (!b.last_recall_at) return true;
            const lastRecall = new Date(b.last_recall_at);
            return lastRecall.toDateString() !== new Date().toDateString();
          })
        : [];
      
      // Find unmastered beats
      const unmasteredBeats = rows.filter(b => !b.is_mastered);
      const unmasteredCount = unmasteredBeats.length;
      
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
      
      setBeatsToRecall(beatsNeedingRecall);
      setNewBeatToLearn(firstUnmastered);
      
      // Determine starting mode
      if (beatsNeedingRecall.length > 0) {
        setSessionMode('recall');
        setRecallIndex(0);
        initializeRecallMode();
      } else if (firstUnmastered) {
        setSessionMode('learn');
        setCurrentBeatIndex(rows.findIndex(b => b.id === firstUnmastered.id));
        
        // Check if there's a saved checkpoint for this beat
        if (firstUnmastered.checkpoint_phase && firstUnmastered.checkpoint_sentence) {
          console.log('🔄 Restoring checkpoint: sentence', firstUnmastered.checkpoint_sentence, 'phase', firstUnmastered.checkpoint_phase);
          
          // Restore the phase
          setPhase(firstUnmastered.checkpoint_phase as Phase);
          
          // Restore hidden word indices if available
          if (firstUnmastered.checkpoint_hidden_indices && Array.isArray(firstUnmastered.checkpoint_hidden_indices)) {
            setHiddenWordIndices(new Set(firstUnmastered.checkpoint_hidden_indices));
            setHiddenWordOrder([...firstUnmastered.checkpoint_hidden_indices]);
          }
        }
      } else {
        // Either all mastered, or already learned today's quota (free user)
        // For free users hitting limit, notify parent to show upsell
        if (!isPremium && unmasteredCount > 0) {
          onSessionLimitReached?.();
        }
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

    const shouldRegenerate =
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

    // Update last practice session time
    await supabase
      .from('speeches')
      .update({ last_practice_session_at: new Date().toISOString() })
      .eq('id', speechId);

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

  // Progressive words to hide: 1 → 2 → 3 (like recall mode)
  const getWordsToHideCount = useCallback((successCount: number): number => {
    // 0 successes = first time = 1 word, 1 success = 2 words, 2+ = 3 words (max)
    return Math.min(1 + successCount, 3);
  }, []);

  // Effect to reset hidden words when changing recall beat
  useEffect(() => {
    if (sessionMode === 'recall' && words.length > 0) {
      // Start fully visible for each recall beat
      setHiddenWordIndices(new Set());
      setHiddenWordOrder([]);
    }
  }, [sessionMode, recallIndex]);

  // Determine which word to hide next (priority order)
  const getNextWordToHide = useCallback((currentHidden: Set<number>): number | null => {
    const visibleIndices = words
      .map((_, i) => i)
      .filter(i => !currentHidden.has(i));
    
    if (visibleIndices.length === 0) return null;
    
    // Priority 1: Common articles/prepositions
    for (const idx of visibleIndices) {
      const word = words[idx].toLowerCase().replace(/[^a-z]/g, '');
      if (COMMON_WORDS.has(word)) return idx;
    }
    
    // Priority 2: Short words (2-4 chars)
    for (const idx of visibleIndices) {
      const word = words[idx].replace(/[^a-zA-Z]/g, '');
      if (word.length >= 2 && word.length <= 4) return idx;
    }
    
    // Priority 3: Middle words (not first or last)
    const middleIndices = visibleIndices.filter(i => i > 0 && i < words.length - 1);
    if (middleIndices.length > 0) return middleIndices[0];
    
    // Priority 4: First visible word (except index 0 of first sentence)
    return visibleIndices[0];
  }, [words]);

  // Normalize word for comparison (language-agnostic)
  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  };

  // Check if spoken word matches expected - STRICT matching
  // More lenient matching for visible words, stricter for hidden
  const wordsMatch = (spoken: string, expected: string, isHidden: boolean = false): boolean => {
    const s = normalizeWord(spoken);
    const e = normalizeWord(expected);
    
    // Exact match - always pass
    if (s === e) return true;
    
    // Empty after normalization
    if (!s || !e) return false;
    
    // For HIDDEN words, be stricter - need to prove they know it
    if (isHidden) {
      // Very short words (1-3 chars) require exact
      if (e.length <= 3) return false;
      
      // Allow 1 char difference, similar length
      if (Math.abs(s.length - e.length) > 1) return false;
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
        if (diff > 1) return false;
      }
      return true;
    }
    
    // For VISIBLE words, be much more lenient - just tracking pace
    // Short words (1-2 chars): require exact
    if (e.length <= 2) return false;
    
    // 3-char words: allow 1 difference
    if (e.length === 3) {
      let diff = 0;
      for (let i = 0; i < 3; i++) {
        if (s[i] !== e[i]) diff++;
      }
      return diff <= 1;
    }
    
    // 4+ char words: be very lenient
    // Check if words share the same first letter (sound)
    if (s[0] !== e[0] && s[0] !== e[1] && (e[0] !== s[1])) {
      // Different starting sound - likely different word
      // But check if it's a prefix/suffix match
      if (!s.startsWith(e.slice(0, 2)) && !e.startsWith(s.slice(0, 2))) {
        return false;
      }
    }
    
    // Allow length variance up to 30%
    const lenRatio = Math.min(s.length, e.length) / Math.max(s.length, e.length);
    if (lenRatio < 0.6) return false;
    
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
    
    // Need at least 60% character overlap
    const overlapRatio = matches / Math.max(s.length, e.length);
    return overlapRatio >= 0.6;
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

    const prevTranscriptLength = transcriptRef.current.split(/\s+/).filter(w => w.trim()).length;
    transcriptRef.current = transcript;
    
    // ONLY process truly new words - never reprocess old ones
    const newWords = rawWords.slice(prevTranscriptLength);
    
    // If no new words, nothing to process (avoid reprocessing recent words)
    if (newWords.length === 0) return;
    
    let advancedTo = currentIdx;
    const newSpoken = new Set(spokenIndicesRef.current);
    const newMissed = new Set(missedIndicesRef.current);

    for (const spoken of newWords) {
      if (advancedTo >= words.length) break;

      // Check if current word is hidden (needs stricter matching)
      const currentIsHidden = hiddenWordIndicesRef.current.has(advancedTo);
      
      // STRICT: Only match the CURRENT word position - no lookahead
      // This prevents jumping to a duplicate word further in the sentence
      let foundIdx = -1;
      if (wordsMatch(spoken, words[advancedTo], currentIsHidden)) {
        foundIdx = advancedTo;
      }

      if (foundIdx === -1) {
        // Current word didn't match - only check NEXT word (lookahead of 1)
        // This handles minor recognition order issues without jumping too far
        const nextIsHidden = hiddenWordIndicesRef.current.has(advancedTo + 1);
        if (advancedTo + 1 < words.length && wordsMatch(spoken, words[advancedTo + 1], nextIsHidden)) {
          // Mark current word as passed (might be a filler or recognition issue)
          if (currentIsHidden) {
            newMissed.add(advancedTo);
          }
          newSpoken.add(advancedTo);
          foundIdx = advancedTo + 1;
        }
      }

      if (foundIdx === -1) {
        // Still no match - this spoken word doesn't match expected sequence
        // Just skip it (could be filler word, cough, background noise, etc.)
        continue;
      }

      // Found a match at current position or nearby - mark all words up to match as spoken
      // If we're jumping ahead (foundIdx > advancedTo), mark skipped hidden words as missed
      for (let j = advancedTo; j < foundIdx; j++) {
        if (hiddenWordIndicesRef.current.has(j)) {
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

    // Handle recall mode completion
    if (sessionMode === 'recall') {
      handleRecallCompletion(hadErrors);
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
        // Successfully recalled this beat twice with all hidden! Update last_recall_at
        const recalledBeat = beatsToRecall[recallIndex];
        if (recalledBeat) {
          supabase
            .from('practice_beats')
            .update({ last_recall_at: new Date().toISOString() })
            .eq('id', recalledBeat.id)
            .then(() => {});
        }

        setCelebrationMessage("✅ Beat recalled!");
        setShowCelebration(true);

        setTimeout(() => {
          setShowCelebration(false);
          
          // Move to next beat to recall, or switch to learn mode
          if (recallIndex < beatsToRecall.length - 1) {
            setRecallIndex(prev => prev + 1);
            setRecallSuccessCount(0);
            // Next recall beat also starts fully visible
            setHiddenWordIndices(new Set());
            setHiddenWordOrder([]);
            resetForNextRep();
          } else {
            // Done with recalls, now learn new beat
            if (newBeatToLearn) {
              setSessionMode('learn');
              setCurrentBeatIndex(beats.findIndex(b => b.id === newBeatToLearn.id));
              transitionToPhase('sentence_1_learning');
            } else {
              // No new beat to learn - update schedule and session complete!
              // Set next review based on spaced repetition
              const hoursUntilNextReview = daysUntilDeadline <= 1 ? 4 : daysUntilDeadline <= 3 ? 8 : daysUntilDeadline <= 7 ? 12 : 24;
              const nextReviewDate = new Date(Date.now() + hoursUntilNextReview * 60 * 60 * 1000);
              
              // Update schedule and speech - await to ensure it's written before UI updates
              (async () => {
                try {
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
                  
                  // Also update speech's next_review_date
                  await supabase
                    .from('speeches')
                    .update({ next_review_date: nextReviewDate.toISOString() })
                    .eq('id', speechId);
                  
                  console.log('📅 Schedule updated. Next review:', nextReviewDate);
                } catch (error) {
                  console.error('Failed to update schedule:', error);
                }
              })();
              
              setSessionMode('session_complete');
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

  // Track fading success count for progressive hiding (1 → 2 → 3)
  const [fadingSuccessCount, setFadingSuccessCount] = useState(0);
  
  // Handle fading phase completion logic
  function handleFadingCompletion(hadErrors: boolean, failedSet: Set<number>) {
    const allHidden = hiddenWordIndices.size >= words.length;

    // Always hide words progressively (1 → 2 → 3), even with errors
    if (!allHidden) {
      // On error: still hide 1 word. On success: progressive 1 → 2 → 3
      const wordsToHide = hadErrors ? 1 : Math.min(1 + fadingSuccessCount, 3);
      
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
      
      // If there were errors, reveal those specific failed words (make them visible again)
      if (hadErrors) {
        failedSet.forEach((idx) => {
          newHidden.delete(idx);
          // Remove from order if present
          const orderIdx = newOrder.indexOf(idx);
          if (orderIdx !== -1) {
            newOrder.splice(orderIdx, 1);
          }
        });
        setFadingSuccessCount(0); // Reset progression on error
        setConsecutiveNoScriptSuccess(0);
      } else {
        setFadingSuccessCount(prev => Math.min(prev + 1, 2)); // Cap at 2 (so max = 3)
      }
      
      setHiddenWordIndices(newHidden);
      setHiddenWordOrder(newOrder);
      setFailedWordIndices(new Set());
      resetForNextRep();
    } else {
      // All words hidden - check for mastery
      const newConsecutive = consecutiveNoScriptSuccess + 1;
      
      if (newConsecutive >= 2) {
        if (phase === 'beat_fading') {
          showBeatCelebration();
        } else {
          showSentenceCelebration();
        }
      } else {
        setConsecutiveNoScriptSuccess(newConsecutive);
        resetForNextRep();
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
    runningTranscriptRef.current = "";
    lastWordTimeRef.current = Date.now();
  };

  const transitionToPhase = (newPhase: Phase) => {
    setPhase(newPhase);
    setRepetitionCount(1);
    repetitionCountRef.current = 1;
    setHiddenWordIndices(new Set());
    setHiddenWordOrder([]);
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
      await supabase
        .from('practice_beats')
        .update({ 
          is_mastered: true, 
          mastered_at: new Date().toISOString(),
          // Advance stage: day1_sentences → day2_beats (for next day's practice)
          practice_stage: 'day2_beats',
          words_hidden_per_round: 2,
          stage_started_at: new Date().toISOString(),
          consecutive_perfect_recalls: 0,
          // Clear checkpoint since beat is now mastered
          checkpoint_sentence: null,
          checkpoint_phase: null,
          checkpoint_hidden_indices: null,
        })
        .eq('id', currentBeat.id);
      
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
          ? { ...b, is_mastered: true, mastered_at: new Date().toISOString() }
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
      
      // Check if we need to learn more beats today (intensive mode)
      const shouldContinueToday = isPremium && nextUnmastered && beatsPerDay > 1 && beatsLearnedToday < beatsPerDay;
      
      if (shouldContinueToday && nextUnmastered) {
        // Premium with intensive mode: Show rest screen before next beat
        const restMins = calculateRestMinutes(daysUntilDeadline);
        setRestMinutes(restMins);
        setRestUntilTime(new Date(Date.now() + restMins * 60 * 1000));
        setNextBeatQueued(nextUnmastered);
        
        setCelebrationMessage("🏆 " + t('beat_practice.beat_complete_rest', "Beat mastered! Take a short break."));
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          setSessionMode('beat_rest');
        }, 2000);
      } else if (isPremium && nextUnmastered && beatsPerDay === 1) {
        // Premium with 1 beat/day: Session complete (come back tomorrow)
        setCelebrationMessage("🏆 " + t('beat_practice.beat_complete', "Beat mastered! Session complete."));
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          setSessionMode('session_complete');
        }, 2500);
      } else {
        // Free user or all beats mastered: Session complete
        setCelebrationMessage("🏆 " + t('beat_practice.beat_complete', "Beat mastered! Session complete."));
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          // Check if free user has more beats to learn (trigger upsell)
          if (!isPremium && nextUnmastered) {
            onSessionLimitReached?.();
          }
          setSessionMode('session_complete');
        }, 2500);
      }
    }
  };
  
  // Start next beat after rest period
  const startNextBeat = () => {
    if (nextBeatQueued) {
      setNewBeatToLearn(nextBeatQueued);
      setCurrentBeatIndex(beats.findIndex(b => b.id === nextBeatQueued.id));
      setNextBeatQueued(null);
      setRestUntilTime(null);
      setRestMinutes(0);
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
      recognition.lang = speechLang || (typeof navigator !== 'undefined' ? navigator.language : 'en-US');

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
            setHesitatedIndices((prev) => {
              if (prev.has(idx)) return prev;
              return new Set([...prev, idx]);
            });
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
          {t('beat_practice.rest_title', "Take a short break!")}
        </h2>
        
        <p className="text-muted-foreground max-w-md">
          {t('beat_practice.rest_reason', "Your brain needs a few minutes to consolidate what you just learned.")}
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
            {t('beat_practice.beats_remaining', `${beatsRemaining} beat${beatsRemaining !== 1 ? 's' : ''} remaining today`)}
          </p>
        </div>
        
        <Button variant="ghost" onClick={startNextBeat} className="mt-4">
          <Play className="h-4 w-4 mr-2" />
          {t('beat_practice.skip_rest', "Start now anyway")}
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
            ? t('beat_practice.all_mastered', "🎉 All beats mastered!")
            : t('beat_practice.session_complete', "Session Complete!")}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {allMastered 
            ? t('beat_practice.poem_memorized', "You've memorized the entire poem! Practice again tomorrow to reinforce.")
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
        sublabel: `Recall ${recallSuccessCount} of ${beatsToRecall.length}`,
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
                const allIndices = new Set(words.map((_, i) => i));
                pauseSpeechRecognition(900);
                checkCompletion(allIndices, failedWordIndices);
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <SkipForward className="h-4 w-4 mr-1" />
              <span className="text-xs">{t('common.skip', 'Skip')}</span>
            </Button>
          )}
          
          {/* Progress bar */}
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  sessionMode === 'recall' ? "bg-amber-500" : "bg-primary"
                )}
                style={{ 
                  width: `${sessionMode === 'recall' 
                    ? ((recallIndex + 1) / Math.max(beatsToRecall.length, 1)) * 100 
                    : phase.includes('beat') 
                      ? 100 
                      : (getCurrentSentenceNumber() / 3) * 100}%` 
                }}
              />
            </div>
          </div>
          
          {/* Session badge */}
          <div className={cn(
            "shrink-0 px-3 py-1 rounded-full text-xs font-semibold",
            sessionMode === 'recall' 
              ? "bg-amber-500/20 text-amber-500" 
              : "bg-primary/20 text-primary"
          )}>
            {sessionMode === 'recall' ? '🔄' : '📚'} {progressInfo.sublabel}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl space-y-6">
          
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

          {/* Phase pill */}
          <div className="flex justify-center">
            <span className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              getPhaseType() === 'learning' && "bg-blue-500/10 text-blue-500",
              getPhaseType() === 'fading' && "bg-amber-500/10 text-amber-500",
              getPhaseType() === 'combining' && "bg-purple-500/10 text-purple-500"
            )}>
              {getPhaseType() === 'learning' && (
                <>
                  <Circle className="h-3 w-3 fill-current" />
                  Read aloud {repetitionCount}/{requiredLearningReps}
                </>
              )}
              {getPhaseType() === 'fading' && (
                <>
                  <GraduationCap className="h-4 w-4" />
                  {words.length - hiddenWordIndices.size} words visible
                </>
              )}
              {getPhaseType() === 'combining' && 'Combining sentences'}
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
                  
                  {/* "One more time!" indicator when 1 more recall needed */}
                  {(sessionMode === 'recall' || phase.includes('fading')) && 
                   hiddenWordIndices.size === words.length && 
                   ((sessionMode === 'recall' && recallSuccessCount === 1) || 
                    (sessionMode !== 'recall' && consecutiveNoScriptSuccess === 1)) && (
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

                  {/* Progress indicator for fading mode */}
                  {(sessionMode === 'recall' || phase.includes('fading')) && (
                    <div className="mt-8 flex items-center gap-4">
                      <div className="relative w-14 h-14">
                        <svg className="w-14 h-14 -rotate-90">
                          <circle
                            cx="28" cy="28" r="24"
                            fill="none"
                            stroke="hsl(var(--muted))"
                            strokeWidth="4"
                          />
                          <circle
                            cx="28" cy="28" r="24"
                            fill="none"
                            stroke="hsl(var(--primary))"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${(hiddenWordIndices.size / Math.max(words.length, 1)) * 151} 151`}
                            className="transition-all duration-300"
                          />
                        </svg>
                        <CheckCircle2 
                          className={cn(
                            "absolute inset-0 m-auto w-6 h-6 transition-colors duration-300",
                            hiddenWordIndices.size === words.length ? "text-primary" : "text-muted-foreground/30"
                          )}
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold">
                          {sessionMode === 'recall' 
                            ? `${recallSuccessCount}/2 recalls`
                            : `${hiddenWordIndices.size}/${words.length} mastered`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sessionMode === 'recall' ? 'Recall from memory' : 'Words fading away'}
                        </p>
                      </div>
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
