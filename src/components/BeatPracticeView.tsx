import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, Sparkles, CheckCircle2, ChevronRight, Brain, BookOpen, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import BeatProgress from "./BeatProgress";
import SentenceDisplay from "./SentenceDisplay";
import { motion, AnimatePresence } from "framer-motion";

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
}

interface BeatPracticeViewProps {
  speechId: string;
  onComplete?: () => void;
  onExit?: () => void;
}

type Phase = 'sentence_1_learning' | 'sentence_1_fading' | 'sentence_2_learning' | 'sentence_2_fading' | 'sentences_1_2_learning' | 'sentences_1_2_fading' | 'sentence_3_learning' | 'sentence_3_fading' | 'beat_learning' | 'beat_fading';

// Session modes: recall (quick review of mastered beats) or learn (learning a new beat)
type SessionMode = 'recall' | 'learn' | 'session_complete';

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

const BeatPracticeView = ({ speechId, onComplete, onExit }: BeatPracticeViewProps) => {
  const { t } = useTranslation();
  
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
  
  // Get current sentence text based on phase
  const getCurrentText = useCallback(() => {
    if (!currentBeat) return "";
    
    // In recall mode, show all 3 sentences together (fully hidden for quick recall)
    if (sessionMode === 'recall') {
      return `${currentBeat.sentence_1_text} ${currentBeat.sentence_2_text} ${currentBeat.sentence_3_text}`;
    }
    
    if (phase === 'beat_learning' || phase === 'beat_fading') {
      return `${currentBeat.sentence_1_text} ${currentBeat.sentence_2_text} ${currentBeat.sentence_3_text}`;
    }
    
    if (phase === 'sentences_1_2_learning' || phase === 'sentences_1_2_fading') {
      return `${currentBeat.sentence_1_text} ${currentBeat.sentence_2_text}`;
    }
    
    if (phase.startsWith('sentence_1')) return currentBeat.sentence_1_text;
    if (phase.startsWith('sentence_2')) return currentBeat.sentence_2_text;
    if (phase.startsWith('sentence_3')) return currentBeat.sentence_3_text;
    
    return "";
  }, [currentBeat, phase, sessionMode]);

  const currentText = getCurrentText();
  const words = currentText.split(/\s+/).filter(w => w.trim());

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
    if (sessionMode === 'recall') return 3; // Full beat in recall
    if (phase.startsWith('sentence_1')) return 1;
    if (phase.startsWith('sentence_2')) return 2;
    if (phase.startsWith('sentences_1_2')) return 2; // Show as "after S2"
    if (phase.startsWith('sentence_3')) return 3;
    return 3; // beat_learning/fading
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
    const daysUntilDeadline = goalDate 
      ? Math.ceil((goalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 30; // Default to 30 days if no deadline

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
      const beatsPerDay = calculateBeatsPerDay(unmasteredCount, daysUntilDeadline);
      
      // Count how many beats were already mastered today
      const beatsLearnedToday = rows.filter(b => {
        if (!b.mastered_at) return false;
        const masteredDate = new Date(b.mastered_at);
        return masteredDate.toDateString() === new Date().toDateString();
      }).length;
      
      // Can we learn more beats today?
      const canLearnMore = beatsLearnedToday < beatsPerDay;
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
      } else {
        // Either all mastered, or already learned today's quota
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

  // Initialize recall mode - all words hidden
  const initializeRecallMode = () => {
    // We'll set hidden words after the text is available
    setPhase('beat_fading'); // Use beat_fading phase for recall
    setRepetitionCount(1);
    repetitionCountRef.current = 1;
    setConsecutiveNoScriptSuccess(0);
    setRecallSuccessCount(0);
  };

  // Effect to hide all words when entering recall mode
  useEffect(() => {
    if (sessionMode === 'recall' && words.length > 0) {
      // Hide all words for recall
      const allIndices = new Set(words.map((_, i) => i));
      setHiddenWordIndices(allIndices);
      setHiddenWordOrder(words.map((_, i) => i));
    }
  }, [sessionMode, words.length, recallIndex]);

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

  // Check if spoken word matches expected
  const wordsMatch = (spoken: string, expected: string): boolean => {
    const s = normalizeWord(spoken);
    const e = normalizeWord(expected);
    if (s === e) return true;
    
    // Allow minor typos (1 char difference for words > 3 chars)
    if (e.length > 3) {
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
      }
      if (diff <= 1) return true;
    }
    
    return false;
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
    
    const newWords = rawWords.slice(prevTranscriptLength);
    const recentWords = rawWords.slice(Math.max(0, rawWords.length - 6));
    const wordsToCheck = newWords.length > 0 ? newWords : recentWords;
    
    let advancedTo = currentIdx;
    const newSpoken = new Set(spokenIndicesRef.current);

    for (const spoken of wordsToCheck) {
      if (advancedTo >= words.length) break;

      let foundIdx = -1;
      for (let i = advancedTo; i < Math.min(advancedTo + 3, words.length); i++) {
        if (wordsMatch(spoken, words[i])) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) continue;

      for (let j = advancedTo; j <= foundIdx; j++) {
        newSpoken.add(j);
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

  }, [words, wordsMatch]);

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

  // Handle recall mode completion
  function handleRecallCompletion(hadErrors: boolean) {
    pauseSpeechRecognition(1200);

    if (hadErrors) {
      // Failed recall - reset and try again
      setRecallSuccessCount(0);
      setCelebrationMessage("🔄 Try again");
      setShowCelebration(true);
      
      setTimeout(() => {
        setShowCelebration(false);
        resetForNextRep();
      }, 1200);
    } else {
      const newCount = recallSuccessCount + 1;
      
      if (newCount >= 2) {
        // Successfully recalled this beat! Update last_recall_at
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
            resetForNextRep();
          } else {
            // Done with recalls, now learn new beat
            if (newBeatToLearn) {
              setSessionMode('learn');
              setCurrentBeatIndex(beats.findIndex(b => b.id === newBeatToLearn.id));
              transitionToPhase('sentence_1_learning');
            } else {
              // No new beat to learn - session complete!
              setSessionMode('session_complete');
            }
          }
        }, 1800);
      } else {
        // Need one more successful recall
        setRecallSuccessCount(newCount);
        setCelebrationMessage(`${newCount}/2 ✓`);
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          resetForNextRep();
        }, 800);
      }
    }
  }

  // Handle fading phase completion logic
  function handleFadingCompletion(hadErrors: boolean, failedSet: Set<number>) {
    const allHidden = hiddenWordIndices.size >= words.length;

    if (hadErrors) {
      setConsecutiveNoScriptSuccess(0);
      
      // Reveal words proportional to familiarity (reveal as many as we hide per success)
      if (hiddenWordOrder.length > 0) {
        const wordsToReveal = Math.min(wordsToHidePerSuccess, hiddenWordOrder.length);
        const indicesToReveal = hiddenWordOrder.slice(-wordsToReveal);
        
        setHiddenWordIndices((prev) => {
          const next = new Set(prev);
          indicesToReveal.forEach(idx => next.delete(idx));
          return next;
        });
        setHiddenWordOrder((prev) => prev.slice(0, -wordsToReveal));
      }
      setFailedWordIndices(new Set());
      resetForNextRep();
    } else if (!allHidden) {
      // Hide multiple words based on familiarity level
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      for (let i = 0; i < wordsToHidePerSuccess; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        } else {
          break; // No more words to hide
        }
      }
      
      setHiddenWordIndices(newHidden);
      setHiddenWordOrder(newOrder);
      resetForNextRep();
    } else {
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

    lastCompletionRepIdRef.current = -1;
    pauseSpeechRecognition(900);
    resetForNextRep();
  };

  const showSentenceCelebration = () => {
    const currentPhase = phase;
    
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

        if (currentPhase === 'sentence_1_fading') {
          transitionToPhase('sentence_2_learning');
        } else if (currentPhase === 'sentence_2_fading') {
          transitionToPhase('sentences_1_2_learning');
        } else if (currentPhase === 'sentences_1_2_fading') {
          transitionToPhase('sentence_3_learning');
        } else if (currentPhase === 'sentence_3_fading') {
          transitionToPhase('beat_learning');
        }
      }, 2000);
    }, 150);
  };

  const showBeatCelebration = async () => {
    // Mark beat as mastered with timestamp
    if (currentBeat) {
      await supabase
        .from('practice_beats')
        .update({ 
          is_mastered: true, 
          mastered_at: new Date().toISOString() 
        })
        .eq('id', currentBeat.id);
    }

    // SESSION COMPLETE - Don't auto-continue to next beat!
    // This is the key change: stop after mastering ONE beat
    setCelebrationMessage("🏆 " + t('beat_practice.beat_complete', "Beat mastered! Session complete."));
    setShowCelebration(true);
    
    setTimeout(() => {
      setShowCelebration(false);
      // End the session - don't continue to next beat
      setSessionMode('session_complete');
    }, 2500);
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

  // Session complete screen
  if (sessionMode === 'session_complete') {
    const masteredCount = beats.filter(b => b.is_mastered).length;
    const totalBeats = beats.length;
    const allMastered = masteredCount === totalBeats;

    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <Trophy className="h-20 w-20 text-primary animate-pulse" />
        <h2 className="text-2xl font-bold">
          {allMastered 
            ? t('beat_practice.all_mastered', "🎉 All beats mastered!")
            : t('beat_practice.session_complete', "Session Complete!")}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {allMastered 
            ? t('beat_practice.poem_memorized', "You've memorized the entire poem! Practice again tomorrow to reinforce.")
            : t('beat_practice.come_back', `You've mastered ${masteredCount}/${totalBeats} beats. Come back in a few hours to learn the next one!`)}
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {t('beat_practice.science_tip', "Sleep strengthens memories more than repetition")}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
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
        sublabel: `Beat ${recallIndex + 1}/${beatsToRecall.length}`,
      };
    }
    return {
      label: t('beat_practice.learn_mode', '📚 Learning New Beat'),
      sublabel: `Beat ${currentBeatIndex + 1}/${beats.length}`,
    };
  };

  const progressInfo = getProgressInfo();

  return (
    <div className="flex flex-col h-full p-4">
      {/* Compact session mode indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium",
            sessionMode === 'recall' 
              ? "bg-amber-500/20 text-amber-500" 
              : "bg-primary/20 text-primary"
          )}>
            {sessionMode === 'recall' ? '🔄 Recall' : '📚 Learn'}
          </div>
          <span className="text-sm text-muted-foreground">{progressInfo.sublabel}</span>
        </div>
        
        {/* Beat dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: sessionMode === 'recall' ? beatsToRecall.length : beats.length }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx < (sessionMode === 'recall' ? recallIndex : currentBeatIndex)
                  ? "bg-primary"
                  : idx === (sessionMode === 'recall' ? recallIndex : currentBeatIndex)
                  ? "bg-primary ring-2 ring-primary/30 ring-offset-1 ring-offset-background"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Sentence progress pills (only in learn mode) */}
      {sessionMode === 'learn' && !phase.includes('beat') && (
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((sentenceNum) => {
            const currentSentence = getCurrentSentenceNumber();
            const isComplete = sentenceNum < currentSentence;
            const isCurrent = sentenceNum === currentSentence;
            return (
              <div
                key={sentenceNum}
                className={cn(
                  "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary/20 text-primary ring-1 ring-primary/50",
                  !isComplete && !isCurrent && "bg-muted/50 text-muted-foreground"
                )}
              >
                {isComplete && <CheckCircle2 className="h-3 w-3" />}
                <span>S{sentenceNum}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Phase indicator */}
      <div className="text-center mb-4">
        <span className={cn(
          "inline-block px-4 py-1.5 rounded-full text-sm font-medium",
          getPhaseType() === 'learning' && "bg-blue-500/20 text-blue-400",
          getPhaseType() === 'fading' && "bg-amber-500/20 text-amber-400",
          getPhaseType() === 'combining' && "bg-purple-500/20 text-purple-400"
        )}>
          {getPhaseType() === 'learning' && `Read ${repetitionCount}/3`}
          {getPhaseType() === 'fading' && `${words.length - hiddenWordIndices.size} words left`}
          {getPhaseType() === 'combining' && 'Combining sentences'}
        </span>
      </div>

      {/* Main content area - larger and centered */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <Card className="w-full max-w-3xl overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex items-center justify-center p-6 md:p-10">
            <AnimatePresence mode="wait">
              {showCelebration ? (
                <motion.div
                  key="celebration"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex flex-col items-center gap-6 py-12"
                >
                  <Sparkles className="h-20 w-20 text-primary animate-pulse" />
                  <p className="text-3xl font-bold text-primary text-center">{celebrationMessage}</p>
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
                  
                  {/* Progress indicator for fading mode */}
                  {(sessionMode === 'recall' || phase.includes('fading')) && (
                    <div className="mt-8 flex items-center gap-4">
                      <div className="relative w-12 h-12">
                        <svg className="w-12 h-12 -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            className="text-muted/20"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="text-primary transition-all duration-300"
                            strokeDasharray={`${(hiddenWordIndices.size / Math.max(words.length, 1)) * 125.6} 125.6`}
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
                        <p className="text-sm font-medium">
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
          </CardContent>
        </Card>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-4 pt-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            stopListening();
            onExit?.();
          }}
          className="rounded-full h-12 w-12"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
        
        {!showCelebration && (
          <Button
            variant="default"
            size="lg"
            onClick={() => {
              const allIndices = new Set(words.map((_, i) => i));
              pauseSpeechRecognition(900);
              checkCompletion(allIndices, failedWordIndices);
            }}
            className="rounded-full gap-2 px-6 h-12"
          >
            {t('common.continue', 'Continue')}
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default BeatPracticeView;
