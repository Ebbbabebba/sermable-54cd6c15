import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { FORCE_PREMIUM, effectiveTier } from "@/lib/premiumOverride";
import { dateFormatter } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Play, RotateCcw, Presentation, X, Square, Eye, Target, Pencil, Clock, Lock, AlertTriangle, GraduationCap, Infinity as InfinityIcon, ChevronRight, CheckCircle2, Circle, Flame, Sunrise, Mic, Headphones, Brain, BookOpen, ArrowLeftRight, Settings, CalendarIcon, Printer } from "lucide-react";
import { printSpeechKeycards } from "@/utils/printKeycards";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdaptiveTempo } from "@/hooks/useAdaptiveTempo";
import { format } from "date-fns";
import PracticeResults from "@/components/PracticeResults";
import BracketedTextDisplay from "@/components/BracketedTextDisplay";
import LoadingOverlay from "@/components/LoadingOverlay";
import LockCountdown from "@/components/LockCountdown";
import BeatPracticeView from "@/components/BeatPracticeView";
import DayAfterRecallView from "@/components/DayAfterRecallView";
import { LearningModeSelector } from "@/components/LearningModeSelector";
import KnowledgeTestDialog from "@/components/KnowledgeTestDialog";
import { useTheme } from "@/contexts/ThemeContext";
import { stripStageDirections } from "@/utils/stageDirections";
import { phoneticMatch } from "@/utils/wordRecognition";
import { PauseSlidersList } from "@/components/PauseSlidersList";
import PropCueTextarea from "@/components/PropCueTextarea";
import { Slider } from "@/components/ui/slider";
import {
  getHesitationThresholdMs,
  setHesitationThresholdMs,
  MIN_HESITATION_MS,
  MAX_HESITATION_MS,
} from "@/lib/practicePrefs";
import { warmupSpeechRecognition } from "@/lib/speechWarmup";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  base_word_visibility_percent: number | null;
  speech_language: string | null;
  speech_type?: string | null;
  next_review_date?: string | null;
  learning_mode?: string | null;
  familiarity_level?: string | null;
  knowledge_test_completed_at?: string | null;
}

interface Segment {
  id: string;
  segment_order: number;
  start_word_index: number;
  end_word_index: number;
  segment_text: string;
  is_mastered: boolean;
  times_practiced: number;
  average_accuracy: number | null;
  merged_with_next: boolean;
  visibility_percent?: number;
  anchor_keywords?: number[];
  next_review_at?: string;
}

interface SessionResults {
  transcription: string;
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  connectorWords: string[];
  difficultyScore: number;
  analysis: string;
  cueText: string;
  missedIndices?: number[];
  hesitatedIndices?: number[];
}

const Practice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRecallMode = searchParams.get('recall') === 'morning';
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { theme } = useTheme();
  const adaptiveTempo = useAdaptiveTempo();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentIndices, setActiveSegmentIndices] = useState<number[]>([]);
  const [activeSegmentText, setActiveSegmentText] = useState<string>("");
  const [activeSegmentOriginalText, setActiveSegmentOriginalText] = useState<string>(""); // Original text for active segment (for analysis)
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isDayAfterRecall, setIsDayAfterRecall] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>(() => {
    if (FORCE_PREMIUM) return 'regular';
    try {
      const v = localStorage.getItem('sermable.subscription_tier');
      if (v === 'free' || v === 'student' || v === 'regular' || v === 'enterprise') return v;
    } catch {}
    return 'free';
  });
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLocked, setIsLocked] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editedScriptText, setEditedScriptText] = useState("");
  const [showTimingWarning, setShowTimingWarning] = useState(false);
  const [showSpacedRepetitionInfo, setShowSpacedRepetitionInfo] = useState(false);
  const [showKnowledgeTest, setShowKnowledgeTest] = useState(false);
  const [showSpeechSettings, setShowSpeechSettings] = useState(false);
  const [editingLearningMode, setEditingLearningMode] = useState<string>('word_by_word');
  const [editingDeadline, setEditingDeadline] = useState<Date | undefined>(undefined);
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [todaySessionDone, setTodaySessionDone] = useState(false);
  const [practiceBeats, setPracticeBeats] = useState<{ id: string; beat_order: number; is_mastered: boolean; mastered_at: string | null; last_recall_at: string | null; sentence_1_text: string; sentence_2_text: string; sentence_3_text: string }[]>([]);
  // Legacy settings for old practice mode (kept for reference, not used in beat mode)
  const settings = {
    revealSpeed: 5,
    showWordOnPause: true,
    animationStyle: 'playful' as const,
    keywordMode: false,
    hesitationThreshold: 5,
    firstWordHesitationThreshold: 6,
    sentenceStartDelay: 5,
  };
  const [averageWordDelay, setAverageWordDelay] = useState<number>(500); // Track user's average pace - start faster
  const wordTimingsRef = useRef<number[]>([]); // Store recent word timing intervals
  // Use refs for real-time tracking to avoid stale closures
  const expectedWordIndexRef = useRef<number>(0);
  const processedTranscriptLengthRef = useRef<number>(0);
  
  // Word processing queue for staggered visual updates
  interface QueuedWord {
    action: 'spoken' | 'hesitated' | 'missed';
    index: number;
    word: string;
  }
  const wordQueueRef = useRef<QueuedWord[]>([]);
  const isProcessingQueueRef = useRef(false);
  const queueProcessorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [liveTranscription, setLiveTranscription] = useState("");
  const [spokenWordsIndices, setSpokenWordsIndices] = useState<Set<number>>(new Set());
  const [hesitatedWordsIndices, setHesitatedWordsIndices] = useState<Set<number>>(new Set());
  const [missedWordsIndices, setMissedWordsIndices] = useState<Set<number>>(new Set());
  
  // Refs to avoid stale closure issues in handleRecordingComplete
  const spokenWordsIndicesRef = useRef<Set<number>>(new Set());
  const hesitatedWordsIndicesRef = useRef<Set<number>>(new Set());
  const missedWordsIndicesRef = useRef<Set<number>>(new Set());
  const [currentHiddenIndices, setCurrentHiddenIndices] = useState<Set<number>>(new Set()); // Track hidden word indices for context-aware coloring
  const [completedSegments, setCompletedSegments] = useState<Set<number>>(new Set());
  const [segmentErrors, setSegmentErrors] = useState<Map<number, number>>(new Map());
  const [segmentHesitations, setSegmentHesitations] = useState<Map<number, number>>(new Map());
  const [expectedWordIndex, setExpectedWordIndex] = useState(0);
  const [lastProcessedTranscriptLength, setLastProcessedTranscriptLength] = useState(0);
  const [supportWord, setSupportWord] = useState<string | null>(null);
  const [supportWordIndex, setSupportWordIndex] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0); // Progressive hint level
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-scheduling state (no manual rating)
  const [adaptiveScheduleResult, setAdaptiveScheduleResult] = useState<{
    intervalMinutes: number;
    nextReviewDate: string;
    weightedAccuracy: number;
    wordVisibility: number;
    recommendation: string;
    learningStage: string;
  } | null>(null);
  const lastWordTimeRef = useRef<number>(Date.now());
  const hesitationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const transcriptionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedChunkIndex = useRef(0);
  const recognitionRef = useRef<any>(null);
  const audioFormatRef = useRef<string>('audio/webm');

  useEffect(() => {
    // Warm up speech recognition as early as possible so the first tap on
    // the mic button is near-instant (permissions cached, engine primed).
    warmupSpeechRecognition();
  }, []);

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, skill_level")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(effectiveTier(profile.subscription_tier));
          try { localStorage.setItem('sermable.subscription_tier', profile.subscription_tier); } catch {}
          setSkillLevel((profile.skill_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

  const determineActiveSegments = (allSegments: Segment[], speechData?: Speech | null) => {
    const currentSpeech = speechData || speech;

    const getTextSliceForSegments = (speechText: string, segs: Segment[]): string => {
      if (!speechText) return "";
      const words = speechText.split(/\s+/).filter((w) => w.trim());
      const startIdx = Math.min(...segs.map((s) => s.start_word_index));
      const endIdx = Math.max(...segs.map((s) => s.end_word_index));
      return words.slice(startIdx, endIdx + 1).join(" ");
    };

    // Original text is used for analysis (no brackets)
    const getOriginalTextForSegments = (segs: Segment[]): string => {
      if (!currentSpeech?.text_original) return "";
      return getTextSliceForSegments(currentSpeech.text_original, segs);
    };

    // Current text is used for display (may contain [brackets] for hidden words)
    const getCurrentTextForSegments = (segs: Segment[]): string => {
      const source = currentSpeech?.text_current || currentSpeech?.text_original || "";
      return getTextSliceForSegments(source, segs);
    };

    if (allSegments.length === 0) {
      setActiveSegmentIndices([]);
      setActiveSegmentText(currentSpeech?.text_current || currentSpeech?.text_original || "");
      setActiveSegmentOriginalText(currentSpeech?.text_original || "");
      return;
    }

    // SEGMENT PROGRESSION LOGIC:
    // 1. Focus on first unmastered segment ONLY
    // 2. When mastered (100% accuracy + ≤10% visibility) → unlock next segment
    // 3. Focus ONLY on the new segment until it's also mastered
    // 4. When new segment is mastered → MERGE them together (via merged_with_next flag)
    // 5. Practice merged segments together until combined mastery

    // Find all merged segment groups (segments marked with merged_with_next form a chain)
    const getMergedSegmentGroup = (startIdx: number): Segment[] => {
      const group: Segment[] = [];
      let idx = startIdx;
      
      // Go backwards to find the start of the merge chain
      while (idx > 0 && allSegments[idx - 1]?.merged_with_next) {
        idx--;
      }
      
      // Now collect all segments in this merge chain
      while (idx < allSegments.length) {
        group.push(allSegments[idx]);
        if (!allSegments[idx].merged_with_next) break;
        idx++;
      }
      
      return group;
    };

    // Find the first unmastered segment
    const firstUnmasteredIndex = allSegments.findIndex((s) => !s.is_mastered);

    if (firstUnmasteredIndex === -1) {
      // All segments mastered - practice the whole speech
      setActiveSegmentIndices(allSegments.map((s) => s.segment_order));
      setActiveSegmentText(currentSpeech?.text_current || currentSpeech?.text_original || "");
      setActiveSegmentOriginalText(currentSpeech?.text_original || "");
      return;
    }

    // Check if this segment is part of a merged group
    const currentSegment = allSegments[firstUnmasteredIndex];
    
    // Check if the PREVIOUS segment has merged_with_next = true
    // This means both segments were mastered individually and should now be practiced together
    if (firstUnmasteredIndex > 0) {
      const previousSegment = allSegments[firstUnmasteredIndex - 1];
      
      if (previousSegment.merged_with_next) {
        // Previous segment has merged_with_next = true
        // This means we need to practice them TOGETHER now
        const mergedGroup = getMergedSegmentGroup(firstUnmasteredIndex - 1);
        
        setActiveSegmentIndices(mergedGroup.map((s) => s.segment_order));
        setActiveSegmentText(getCurrentTextForSegments(mergedGroup));
        setActiveSegmentOriginalText(getOriginalTextForSegments(mergedGroup));
        
        console.log('📚 Practicing merged segments:', mergedGroup.map(s => s.segment_order + 1).join(' + '));
        return;
      }
    }

    // Not part of a merged group - practice ONLY this segment
    // (Don't merge with mastered previous segment until BOTH are individually mastered)
    setActiveSegmentIndices([currentSegment.segment_order]);
    setActiveSegmentText(getCurrentTextForSegments([currentSegment]));
    setActiveSegmentOriginalText(getOriginalTextForSegments([currentSegment]));
    
    console.log('📚 Focusing on segment:', currentSegment.segment_order + 1);
  };

  // Clean bracket notation from text:
  //  - `[hidden word]` → hidden words: keep the word itself, remove the brackets
  //  - `(stage direction)` → fully removed (regi for the speaker, not for AI)
  const cleanBracketNotation = (text: string): string => {
    return stripStageDirections(text).replace(/\[|\]/g, '');
  };

  // Extract hidden word indices from segment text (words inside [...] are hidden).
  // Stage directions in (...) are stripped first so word indices align with the
  // clean text the speech recognition pipeline sees.
  const extractHiddenIndices = (text: string): Set<number> => {
    const hiddenIndices = new Set<number>();
    let globalWordIndex = 0;

    const cleaned = stripStageDirections(text);
    // Split by bracket boundaries
    const parts = cleaned.split(/(\[[^\]]*\])/);
    
    for (const part of parts) {
      if (part.startsWith('[') && part.endsWith(']')) {
        // This is a bracketed (hidden) section
        const bracketContent = part.slice(1, -1);
        const wordsInBracket = bracketContent.split(/\s+/).filter(w => w.trim());
        for (let i = 0; i < wordsInBracket.length; i++) {
          hiddenIndices.add(globalWordIndex + i);
        }
        globalWordIndex += wordsInBracket.length;
      } else {
        // Visible words
        const visibleWords = part.split(/\s+/).filter(w => w.trim());
        globalWordIndex += visibleWords.length;
      }
    }
    
    console.log('🔍 Extracted hidden indices:', [...hiddenIndices]);
    return hiddenIndices;
  };

  // Update hidden indices when segment text changes
  useEffect(() => {
    if (activeSegmentText) {
      const hiddenSet = extractHiddenIndices(activeSegmentText);
      setCurrentHiddenIndices(hiddenSet);
    }
  }, [activeSegmentText]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runWhenAuthed = async () => {
      // Wait for Supabase to restore the session (iOS/Safari restores asynchronously
      // after JS bridge starts, so a naive load fires unauthenticated → "Load failed").
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        loadSpeech();
      } else {
        // Retry shortly in case the session is still being restored.
        retryTimer = setTimeout(runWhenAuthed, 400);
      }
    };

    runWhenAuthed();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        loadSpeech();
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      sub.subscription.unsubscribe();
    };
  }, [id]);

  const loadSpeech = async () => {
    try {
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpeech(data);

      // Load segments
      const { data: segmentsData, error: segmentsError } = await supabase
        .from("speech_segments")
        .select("*")
        .eq("speech_id", id)
        .order("segment_order", { ascending: true });

      if (segmentsError) {
        console.error('Error loading segments:', segmentsError);
      } else if (segmentsData) {
        setSegments(segmentsData);
        determineActiveSegments(segmentsData, data);
      }
      
      // Check lock status based on AI-recommended next review time
      // First try schedule table, then fallback to speech's next_review_date
      const { data: schedule } = await supabase
        .from("schedules")
        .select("next_review_date")
        .eq("speech_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Use schedule's next_review_date, or fallback to speech's next_review_date
      // But only if beats exist (i.e., speech has been practiced at least once)
      const nextReview = schedule?.next_review_date || data?.next_review_date;
      
      // Check if beats exist first - if no beats, this is a new speech that shouldn't be locked
      const { data: beatsExist } = await supabase
        .from('practice_beats')
        .select('id')
        .eq('speech_id', id)
        .limit(1);
      
      const hasPracticeHistory = beatsExist && beatsExist.length > 0;
      
      if (nextReview && hasPracticeHistory) {
        const reviewDate = new Date(nextReview);
        setNextReviewDate(reviewDate);
        console.log('📅 Next review date set:', reviewDate);
        
        // Lock if review date is in future — but bypass if coming from morning recall
        if (reviewDate > new Date() && !isRecallMode) {
          setIsLocked(true);
          console.log('🔒 Speech locked until:', reviewDate);
        } else {
          setIsLocked(false);
          if (isRecallMode) {
            console.log('☀️ Morning recall mode — bypassing lock');
          }
        }
      } else {
        console.log('ℹ️ No next review date found or speech never practiced');
        setIsLocked(false);
        setNextReviewDate(null);
      }
      
      // Check if today's session is complete
      const { data: beatsData } = await supabase
        .from('practice_beats')
        .select('id, beat_order, is_mastered, mastered_at, last_recall_at, sentence_1_text, sentence_2_text, sentence_3_text')
        .eq('speech_id', id)
        .order('beat_order', { ascending: true });
      
      if (beatsData) {
        setPracticeBeats(beatsData);

        const hasBeats = beatsData.length > 0;
        const today = new Date().toDateString();

        // IMPORTANT: Array.every([]) === true, so we must guard against empty beats.
        const allMastered = hasBeats && beatsData.every((b) => b.is_mastered);
        
        // Count how many beats were mastered today
        const beatsLearnedToday = beatsData.filter((b) => {
          if (!b.mastered_at) return false;
          return new Date(b.mastered_at).toDateString() === today;
        }).length;
        
        // Check if there are unmastered beats remaining
        const hasUnmasteredBeats = beatsData.some((b) => !b.is_mastered);
        
        // Session is "done" if:
        // 1. All beats are mastered, OR
        // 2. User learned at least one beat today AND there's a future lock time AND they have unmastered beats
        //    (meaning they should wait before learning more)
        // If no lock (free user who just mastered), they can continue immediately
        const hasFutureLock = nextReview && new Date(nextReview) > new Date();
        
        // Session is "done" if:
        // 1. All beats mastered AND next review is still in the future (or no review scheduled)
        // 2. User learned beats today AND locked AND has unmastered beats remaining
        // NOT done if all mastered but a recall is due (review date is past) — user should do the recall
        const allMasteredAndNothingDue = allMastered && (!nextReview || hasFutureLock);
        setTodaySessionDone(hasBeats && (allMasteredAndNothingDue || (beatsLearnedToday > 0 && hasFutureLock && hasUnmasteredBeats)));
      }
    } catch (error: any) {
      // Don't kick the user back to the dashboard on transient network errors
      // (e.g. iOS Safari "Load failed"). Show a toast and let the page retry
      // or the user tap again — staying on /practice/:id avoids losing context.
      const msg = String(error?.message ?? error ?? '');
      const isTransient =
        msg.includes('Load failed') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('network');
      console.error('loadSpeech failed:', error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: msg,
      });
      if (!isTransient) {
        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const computeNextBeatReviewDate = (goalDate: string | null | undefined) => {
    const now = Date.now();

    // Default: 24 hours
    if (!goalDate) {
      return new Date(now + 24 * 60 * 60 * 1000);
    }

    const goal = new Date(goalDate);
    const msUntilGoal = goal.getTime() - now;
    const daysUntilGoal = Math.ceil(msUntilGoal / (24 * 60 * 60 * 1000));

    const hoursUntilNextReview =
      daysUntilGoal <= 1 ? 4 : daysUntilGoal <= 3 ? 8 : daysUntilGoal <= 7 ? 12 : 24;

    const next = new Date(now + hoursUntilNextReview * 60 * 60 * 1000);

    // Avoid "Redo nu!" due to clock skew / rounding
    if (next.getTime() - now < 5 * 60 * 1000) {
      return new Date(now + 5 * 60 * 1000);
    }

    return next;
  };

  const ensureNextPracticeScheduled = useCallback(async () => {
    if (!speech?.id) return null;

    // The lock/countdown should mirror the real spaced-repetition schedule,
    // not a flat 24h. Take the earliest UPCOMING recall timestamp across all
    // beats (FSRS `next_scheduled_recall_at` plus the day-1 short cycle).
    // Only if nothing is scheduled at all do we fall back to the legacy
    // deadline-based pacing interval.
    let next: Date | null = null;
    try {
      const { data: recallBeats } = await supabase
        .from('practice_beats')
        .select('recall_10min_at, recall_evening_at, recall_morning_at, next_scheduled_recall_at')
        .eq('speech_id', speech.id);

      const nowMs = Date.now();
      const upcoming: number[] = [];
      for (const b of recallBeats ?? []) {
        for (const v of [b.recall_10min_at, b.recall_evening_at, b.recall_morning_at, b.next_scheduled_recall_at]) {
          if (!v) continue;
          const t = new Date(v).getTime();
          if (t > nowMs) upcoming.push(t);
        }
      }
      if (upcoming.length > 0) {
        next = new Date(Math.min(...upcoming));
      }
    } catch (err) {
      console.warn('⚠️ Could not derive next recall from beats:', err);
    }

    if (!next) {
      next = computeNextBeatReviewDate(speech.goal_date);
    }
    const sessionDate = new Date().toISOString().split('T')[0];

    try {
      const { data: existingSchedule, error: existingError } = await supabase
        .from('schedules')
        .select('id')
        .eq('speech_id', speech.id)
        .eq('session_date', sessionDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.warn('⚠️ Schedule lookup failed:', existingError);
      }

      if (existingSchedule?.id) {
        const { error: updateError } = await supabase
          .from('schedules')
          .update({
            next_review_date: next.toISOString(),
            last_reviewed_at: new Date().toISOString(),
            completed: true,
          })
          .eq('id', existingSchedule.id);

        if (updateError) {
          console.error('❌ Schedule update failed:', updateError);
        }
      } else {
        const { error: insertError } = await supabase
          .from('schedules')
          .insert({
            speech_id: speech.id,
            session_date: sessionDate,
            next_review_date: next.toISOString(),
            last_reviewed_at: new Date().toISOString(),
            completed: true,
          });

        if (insertError) {
          console.error('❌ Schedule insert failed:', insertError);
        }
      }

      const { error: speechUpdateError } = await supabase
        .from('speeches')
        .update({ next_review_date: next.toISOString() })
        .eq('id', speech.id);

      if (speechUpdateError) {
        console.error('❌ Speech next_review_date update failed:', speechUpdateError);
      }

      // Update local state immediately (UI feedback), loadSpeech() will reconcile afterwards.
      setNextReviewDate(next);
      setIsLocked(next > new Date());

      console.log('📅 Next practice scheduled:', next);
      return next;
    } catch (err) {
      console.error('❌ Failed to ensure next practice schedule:', err);
      return null;
    }
  }, [speech?.id, speech?.goal_date]);

  const handleStartPractice = (bypassLock = false, bypassWarning = false, bypassSessionCheck = false, bypassKnowledgeTest = false) => {
    // Keep permission/model preparation inside the user's tap on iOS. The
    // practice view can then begin listening while its lesson data loads.
    void warmupSpeechRecognition();

    // Show knowledge test first for users who marked "somewhat" or "confident" familiarity
    if (
      !bypassKnowledgeTest &&
      speech &&
      !speech.knowledge_test_completed_at &&
      (speech.familiarity_level === "intermediate" || speech.familiarity_level === "confident")
    ) {
      setShowKnowledgeTest(true);
      return;
    }

    
    // Only show spaced repetition warning if actually locked AND has practice history
    // Skip warning if there's no lock, no practice history, or next review date is past/now
    const hasPracticeHistory = practiceBeats.length > 0;
    const isActuallyLocked = isLocked && nextReviewDate && nextReviewDate > new Date() && hasPracticeHistory;
    
    console.log('🔍 Start practice check:', { isLocked, nextReviewDate, hasPracticeHistory, isActuallyLocked, bypassWarning, bypassLock });
    
    if (!bypassWarning && !bypassLock && isActuallyLocked) {
      setShowSpacedRepetitionInfo(true);
      return;
    }
    
    // Check if locked (skip this check if bypassing)
    if (!bypassLock && isActuallyLocked) {
      toast({
        title: t('practice.practiceScheduled'),
        description: t('practice.aiRecommendsAt', { time: format(nextReviewDate, "'at' HH:mm") }),
        duration: 3000,
      });
      return; // Don't start if locked
    }
    
    console.log('✅ Starting practice session');
    setIsPracticing(true);
    setShowResults(false);
    setSessionResults(null);
    
    // Show segment info
    if (activeSegmentIndices.length > 0) {
      const segmentInfo = activeSegmentIndices.length === 1
        ? t('practice.learningSegment', { num: activeSegmentIndices[0] + 1 })
        : t('practice.practicingSegments', { num1: activeSegmentIndices[0] + 1, num2: activeSegmentIndices[1] + 1 });
      
      toast({
        title: t('practice.practiceActivated'),
        description: t('practice.readAloudSegment', { info: segmentInfo }),
        duration: 5000,
      });
    } else {
      toast({
        title: t('practice.practiceActivated'),
        description: t('practice.readAloudGeneral'),
      });
    }
  };
  
  const handleSpacedRepetitionContinue = () => {
    setShowSpacedRepetitionInfo(false);
    // Okay button goes back to dashboard
    navigate("/dashboard");
  };
  
  const handleSpacedRepetitionPracticeAnyway = () => {
    setShowSpacedRepetitionInfo(false);
    handleStartPractice(true, true, true);
  };
  

  const handleSegmentComplete = (segmentIndex: number) => {
    console.log('✅ Segment completed:', segmentIndex);
    
    // Calculate segment-specific performance
    const errors = segmentErrors.get(segmentIndex) || 0;
    const hesitations = segmentHesitations.get(segmentIndex) || 0;
    const totalIssues = errors + hesitations;
    
    console.log(`📊 Segment ${segmentIndex} performance: ${errors} errors, ${hesitations} hesitations`);
    
    // Mark segment as completed
    setCompletedSegments(prev => new Set([...prev, segmentIndex]));
    
    // If this was a difficult segment (many errors/hesitations), the overall
    // session accuracy will reflect this and adaptive learning will adjust accordingly
    if (totalIssues > 3) {
      console.log(`⚠️ Segment ${segmentIndex} had significant difficulty - this will be reflected in session accuracy`);
    }
  };

  const handleRecordingStart = async () => {
    console.log('=== handleRecordingStart CALLED ===');
    setIsRecording(true);
    setLiveTranscription("");
    lastProcessedChunkIndex.current = 0;
    setExpectedWordIndex(0);
    expectedWordIndexRef.current = 0;
    setLastProcessedTranscriptLength(0);
    processedTranscriptLengthRef.current = 0;
    setSupportWord(null);
    setSupportWordIndex(null);
    setHintLevel(0);
    lastWordTimeRef.current = Date.now();
    wordTimingsRef.current = []; // Reset pace tracking
    setAverageWordDelay(500); // Start with faster default pace
    adaptiveTempo.reset(); // Reset adaptive tempo for new session
    
    // Clear any existing hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    
    // Set up speech recognition
    await setupSpeechRecognition();
  };

  // Start progressive hint timer for a word
  const startProgressiveHints = (wordIndex: number, expectedWords: string[], expectedWordsRaw: string[]) => {
    // Clear existing hint timers
    if (hesitationTimerRef.current) clearTimeout(hesitationTimerRef.current);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setHintLevel(0);
    setSupportWord(null);
    setSupportWordIndex(null);
    
    const wordToShow = expectedWords[wordIndex];
    const wordLength = wordToShow.length;
    
    // Check if first word or first word after sentence
    const isFirstWord = wordIndex === 0;
    const isFirstWordAfterSentence = wordIndex > 0 && (() => {
      const prevWordRaw = expectedWordsRaw[wordIndex - 1] ?? '';
      return /[.!?][)"''"]*$/.test(prevWordRaw);
    })();
    
    // Extra delay for sentence starts from settings
    const sentenceStartExtraMs = isFirstWordAfterSentence ? settings.sentenceStartDelay * 1000 : 0;
    
    // Get adaptive delays from tempo analysis
    const { initialDelay, stepDelay } = adaptiveTempo.getAdaptiveHintDelays({
      wordLength,
      isAfterSentence: isFirstWordAfterSentence,
      isFirstWord,
      sentenceStartExtraMs,
    });
    
    console.log(`⏱️ Adaptive hint delays - initial: ${Math.round(initialDelay)}ms, step: ${Math.round(stepDelay)}ms, phase: ${adaptiveTempo.phase}, WPM: ${adaptiveTempo.tempoWPM}`);
    
    // Level 1: First letter hint (adaptive to user pace)
    hesitationTimerRef.current = setTimeout(() => {
      setSupportWord(wordToShow);
      setSupportWordIndex(wordIndex);
      setHintLevel(1);
      console.log('💡 Hint level 1 (first letter):', wordToShow.slice(0, 1) + '___', 'delay:', initialDelay);
      
      // Level 2: More letters (adaptive step)
      hintTimerRef.current = setTimeout(() => {
        setHintLevel(2);
        console.log('💡 Hint level 2 (half word):', wordToShow.slice(0, Math.ceil(wordToShow.length / 2)) + '...', 'step:', stepDelay);
        
        // Level 3: Full word - ALWAYS mark as hesitated (yellow) when full hint is shown
        hintTimerRef.current = setTimeout(() => {
          setHintLevel(3);
          // Always mark as hesitated (yellow) when user needs full hint
          setHesitatedWordsIndices(prev => {
            const updated = new Set([...prev, wordIndex]);
            hesitatedWordsIndicesRef.current = updated;
            return updated;
          });
          console.log('💡 Hint level 3 (full word - marked yellow):', wordToShow);
          
          // Track hesitation for segment
          const segmentIndex = Math.floor((wordIndex / expectedWords.length) * 10);
          setSegmentHesitations(prev => {
            const updated = new Map(prev);
            updated.set(segmentIndex, (updated.get(segmentIndex) || 0) + 1);
            return updated;
          });
        }, stepDelay);
      }, stepDelay);
    }, initialDelay);
  };

  // Clear hint when word is spoken
  const clearHints = () => {
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setSupportWord(null);
    setSupportWordIndex(null);
    setHintLevel(0);
  };

  // Fast word queue processor - process words immediately for responsive feedback
  const processWordQueue = useCallback(() => {
    if (wordQueueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      return;
    }
    
    isProcessingQueueRef.current = true;
    
    // Process ALL queued words immediately for instant feedback
    while (wordQueueRef.current.length > 0) {
      const item = wordQueueRef.current.shift()!;
      
      // Process single word visual update
      // IMPORTANT: Don't remove from hesitated/missed if adding to spoken
      // Hesitated words should stay yellow even after being spoken
      if (item.action === 'spoken') {
        setSpokenWordsIndices(prev => {
          const updated = new Set([...prev, item.index]);
          spokenWordsIndicesRef.current = updated;
          return updated;
        });
        // Only remove from missed, NOT from hesitated - hesitation should persist
        setMissedWordsIndices(prev => { 
          const u = new Set(prev); 
          u.delete(item.index); 
          missedWordsIndicesRef.current = u;
          return u; 
        });
        // Keep hesitated status - don't remove it
      } else if (item.action === 'hesitated') {
        setHesitatedWordsIndices(prev => {
          const updated = new Set([...prev, item.index]);
          hesitatedWordsIndicesRef.current = updated;
          return updated;
        });
        // Also add to spoken since the word was spoken (just with hesitation)
        setSpokenWordsIndices(prev => {
          const updated = new Set([...prev, item.index]);
          spokenWordsIndicesRef.current = updated;
          return updated;
        });
      } else if (item.action === 'missed') {
        setMissedWordsIndices(prev => {
          const updated = new Set([...prev, item.index]);
          missedWordsIndicesRef.current = updated;
          return updated;
        });
      }
      
      console.log(`🔄 Queue processed: ${item.action} "${item.word}" at ${item.index}, remaining: ${wordQueueRef.current.length}`);
    }
    
    isProcessingQueueRef.current = false;
  }, []);

  // Helper to queue word actions
  const queueWordAction = useCallback((action: 'spoken' | 'hesitated' | 'missed', index: number, word: string) => {
    wordQueueRef.current.push({ action, index, word });
    
    // Start processing if not already running
    if (!isProcessingQueueRef.current) {
      processWordQueue();
    }
  }, [processWordQueue]);

  // Map language code to speech recognition locale
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
    return localeMap[lang] || 'en-US';
  };

  const setupSpeechRecognition = async () => {
    try {
      // Use stored language initially for INSTANT start, detect in background
      const speechLang = speech?.speech_language || 'en';
      console.log('🌍 Quick start with language:', speechLang);
      
      // Start Web Speech API IMMEDIATELY for zero delay
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = getRecognitionLocale(speechLang);
        
        console.log('📝 Recognition configured with locale:', recognition.lang);
        
        // Start hints for the FIRST word immediately - no delay
        const cleanedText = cleanBracketNotation(activeSegmentText || speech!.text_original);
        const firstExpectedWordsRaw = cleanedText.split(/\s+/).filter(w => w.trim());
        const firstExpectedWords = firstExpectedWordsRaw
          .map(w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
        startProgressiveHints(0, firstExpectedWords, firstExpectedWordsRaw);
        console.log('🎯 Started progressive hints for first word immediately');
        
        // Background: detect language and update if needed (non-blocking)
        (async () => {
          try {
            const { detectTextLanguage } = await import('@/utils/languageDetection');
            const detectedLang = detectTextLanguage(speech!.text_current);
            
            if (detectedLang && detectedLang !== speechLang) {
              console.log('🔄 Background: Updating stored speech_language from', speechLang, 'to', detectedLang);
              await supabase
                .from('speeches')
                .update({ speech_language: detectedLang })
                .eq('id', speech!.id);
            }
          } catch (e) {
            console.log('Background language detection skipped:', e);
          }
        })();
        
        let finalTranscript = '';
        
        recognition.onresult = (event: any) => {
          console.log('✅ Speech recognition result received!', event.results.length);
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log('📢 Transcript:', transcript, 'isFinal:', event.results[i].isFinal);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
              setLiveTranscription(finalTranscript.trim());
              console.log('✔️ Final transcript updated:', finalTranscript.trim());
            } else {
              interimTranscript += transcript;
              setLiveTranscription((finalTranscript + interimTranscript).trim());
              console.log('⏳ Interim transcript:', (finalTranscript + interimTranscript).trim());
            }
          }
          
          // Track spoken words for bracket visualization
          const fullTranscript = (finalTranscript + interimTranscript).trim();
          const transcriptWords = fullTranscript.toLowerCase().split(/\s+/).filter(w => w.trim());
          
          // Get expected words from the active segment or full speech (clean bracket notation first)
          const cleanedText = cleanBracketNotation(activeSegmentText || speech!.text_original);
          const allExpectedWordsRaw = cleanedText.split(/\s+/).filter(w => w.trim());
          const allExpectedWords = allExpectedWordsRaw
            .map(w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''));
          
          // Helper: Levenshtein distance for fuzzy matching
          const levenshtein = (a: string, b: string): number => {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix: number[][] = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
              for (let j = 1; j <= a.length; j++) {
                matrix[i][j] = b[i-1] === a[j-1] 
                  ? matrix[i-1][j-1]
                  : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
              }
            }
            return matrix[b.length][a.length];
          };
          
          // Helper: Lenient matching — accept partial/prefix utterances so the
          // recognizer doesn't stall on long or hard-to-catch words. Only a
          // genuinely different word fails this check.
          const areWordsSimilar = (spoken: string, expected: string, opts?: { lenient?: boolean }): boolean => {
            if (!spoken || !expected) return false;
            // Exact match
            if (spoken === expected) return true;

            // Sounds-the-same spellings (brand names like "Sermable" → "särmable")
            if (phoneticMatch(spoken, expected)) return true;

            // Prefix match (either direction). Handles "demo" → "demokrati"
            // and "demokratin" → "demokrati" style cuts from the recognizer.
            // Need at least 2 chars of overlap (3 for very long expected words).
            const prefixMin = expected.length >= 8 ? 3 : 2;
            if (spoken.length >= prefixMin && expected.startsWith(spoken)) return true;
            if (expected.length >= prefixMin && spoken.startsWith(expected)) return true;

            // First-char guard: completely different start = not a match
            // (unless lenient mode for visible words, where any overlap counts).
            if (!opts?.lenient && spoken[0] !== expected[0]) {
              // Allow soft phonetic equivalents: h-drop, double letters
              const normSpoken = spoken.replace(/^h/, '').replace(/(.)\1+/g, '$1');
              const normExpected = expected.replace(/^h/, '').replace(/(.)\1+/g, '$1');
              if (normSpoken[0] !== normExpected[0]) return false;
            }

            // Levenshtein with generous thresholds
            const dist = levenshtein(spoken, expected);
            if (expected.length <= 3) return dist <= 1;
            if (expected.length <= 6) return dist <= 2;
            return dist <= 3;
          };

          // Even more lenient match used for VISIBLE words — accept on any
          // utterance that shares a starting fragment, since the word is on
          // screen and the user is reading it.
          const isLooseVisibleMatch = (spoken: string, expected: string): boolean => {
            if (!spoken || !expected) return false;
            if (areWordsSimilar(spoken, expected, { lenient: true })) return true;
            // Share first char + at least 1 more char overlap anywhere in start
            if (spoken[0] === expected[0] && spoken.length >= 2) return true;
            return false;
          };
          
          // Only process NEW words from the transcript using refs (avoid stale closures)
          const prevLength = processedTranscriptLengthRef.current;
          const newWords = transcriptWords.slice(prevLength);
          
          if (newWords.length === 0) return;
          
          console.log('🆕 New words detected:', newWords, 'Previous length:', prevLength, 'Current index:', expectedWordIndexRef.current);
          
          // Process new words using refs for immediate updates
          let currentIdx = expectedWordIndexRef.current;
          
          for (const word of newWords) {
            const cleanSpokenWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            
            if (!cleanSpokenWord || currentIdx >= allExpectedWords.length) continue;
            
            // Hide support word immediately when ANY word is spoken
            const wasSupportWordShowing = supportWord !== null;
            const previousSupportWordIndex = supportWordIndex;
            setSupportWord(null);
            setSupportWordIndex(null);
            
            const expectedWord = allExpectedWords[currentIdx];
            const cleanExpectedWord = expectedWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            
            console.log('🔍 Comparing:', cleanSpokenWord, 'vs', cleanExpectedWord, 'at index', currentIdx);
            
            // Check if spoken word matches expected word.
            // Visible words use a looser match so the recognizer doesn't stall
            // — if the user even starts saying the word it counts as spoken.
            const isVisibleWord = !currentHiddenIndices.has(currentIdx);
            const matched = isVisibleWord
              ? isLooseVisibleMatch(cleanSpokenWord, cleanExpectedWord)
              : areWordsSimilar(cleanSpokenWord, cleanExpectedWord);
            if (matched) {
              // Track timing FIRST to detect hesitation
              const currentTime = Date.now();
              const timeSinceLastWord = currentTime - lastWordTimeRef.current;
              
              // Check if this word is the first word after a sentence-ending punctuation
              // IMPORTANT: use raw expected words so punctuation isn't lost.
              const isFirstWordAfterSentence = currentIdx > 0 && (() => {
                const prevWordRaw = allExpectedWordsRaw[currentIdx - 1] ?? '';
                return /[.!?][)"'’”]*$/.test(prevWordRaw);
              })();
              
              // HESITATION DETECTION: Use adaptive threshold based on tempo analysis
              const isFirstWordInSession = currentIdx === 0;
              const sentenceStartExtraMs = isFirstWordAfterSentence ? settings.sentenceStartDelay * 1000 : 0;
              const wordLength = expectedWord.length;
              
              // Get adaptive threshold from tempo analysis
              const hesitationThresholdMs = adaptiveTempo.getAdaptiveThreshold({
                wordLength,
                isAfterSentence: isFirstWordAfterSentence,
                isFirstWord: isFirstWordInSession,
                sentenceStartExtraMs,
              });
              
              const wasHesitation = timeSinceLastWord > hesitationThresholdMs;
              const wasHintShowing = wasSupportWordShowing && previousSupportWordIndex === currentIdx;
              const currentHintLevel = hintLevel; // Capture current hint level
              
              // Determine if word should be marked as hesitated (yellow)
              // 1. If any hint was showing (user needed visual help) - both visible and hidden words
              // 2. If user took too long (hesitation detected by timing) - BUT NOT for sentence starts
              // 3. If hint reached level 2+ (user clearly needed substantial help)
               const shouldMarkHesitated = 
                 wasHintShowing || // Any hint = hesitation (visible or hidden)
                 (wasHesitation && !isFirstWordAfterSentence) || // Time-based hesitation, but not for sentence starts
                 (currentHintLevel >= 2); // Substantial hint needed

              if (shouldMarkHesitated) {
                queueWordAction('hesitated', currentIdx, expectedWord);
                console.log('⏱️ Word marked hesitated:', expectedWord, 
                  `(delay: ${Math.round(timeSinceLastWord)}ms, threshold: ${Math.round(hesitationThresholdMs)}ms, hintLevel: ${currentHintLevel}, hintShowing: ${wasHintShowing}, afterSentence: ${isFirstWordAfterSentence})`);
              } else {
                // Normal correct word - no hesitation
                queueWordAction('spoken', currentIdx, expectedWord);
                console.log('✓ Word spoken correctly:', expectedWord, 'at index', currentIdx, 
                  `(delay: ${Math.round(timeSinceLastWord)}ms)`);
              }
              
              clearHints();
              currentIdx++;
              
              // Update timing tracking - record to adaptive tempo system
              lastWordTimeRef.current = currentTime;
              
              // Record word timing for adaptive tempo analysis
              if (timeSinceLastWord >= 50 && timeSinceLastWord < 10000) {
                adaptiveTempo.recordWordTiming(timeSinceLastWord, wordLength, isFirstWordAfterSentence);
              }
              
              // Legacy pace tracking for backward compatibility
              if (currentIdx > 1 && timeSinceLastWord < 5000) {
                const weight = wordTimingsRef.current.length < 2 ? 0.85 : 0.6;
                const newAvg = wordTimingsRef.current.length === 0 
                  ? timeSinceLastWord 
                  : averageWordDelay * (1 - weight) + timeSinceLastWord * weight;
                setAverageWordDelay(Math.min(1500, Math.max(150, newAvg)));
                wordTimingsRef.current.push(timeSinceLastWord);
                if (wordTimingsRef.current.length > 5) wordTimingsRef.current.shift();
              }
              
              // Check if we've reached the last word
              if (currentIdx >= allExpectedWords.length) {
                console.log('🎉 Last word spoken! Auto-stopping recording...');
                // audio recorder removed in beat-based system
              } else {
                startProgressiveHints(currentIdx, allExpectedWords, allExpectedWordsRaw);
              }
            } else {
              // Word doesn't match - look ahead to find match
              console.log('⚠️ Spoken word mismatch:', cleanSpokenWord, 'vs expected:', cleanExpectedWord);
              
              let matchFound = false;
              const maxLookAhead = 8;
              
              for (let lookAhead = 1; lookAhead <= maxLookAhead && (currentIdx + lookAhead) < allExpectedWords.length; lookAhead++) {
                const futureWord = allExpectedWords[currentIdx + lookAhead];
                const cleanFutureWord = futureWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
                
                // Use areWordsSimilar for ALL lookahead to handle speech recognition variations
                if (areWordsSimilar(cleanSpokenWord, cleanFutureWord)) {
                  matchFound = true;
                  console.log('✓ Found word ahead at +' + lookAhead + ':', futureWord);
                  
                  // Queue ALL words from current to matched position
                  for (let i = currentIdx; i <= currentIdx + lookAhead; i++) {
                    if (i < currentIdx + lookAhead) {
                      // Skipped words:
                      // ONLY hidden words can be marked as missed (red)
                      // Visible words are NEVER color-marked - just fade them as spoken
                      if (currentHiddenIndices.has(i)) {
                        // First word of speech can NEVER be marked red/yellow - protect confidence
                        if (i === 0) {
                          queueWordAction('spoken', i, allExpectedWords[i]);
                          console.log('⏭️ First word skipped but not marked (protected):', allExpectedWords[i]);
                        } else {
                          queueWordAction('missed', i, allExpectedWords[i]);
                          console.log('❌ Skipped HIDDEN word (red):', allExpectedWords[i], 'at index', i);
                        }
                      } else {
                        // Visible words are NEVER color-marked
                        queueWordAction('spoken', i, allExpectedWords[i]);
                        console.log('⏭️ Skipped visible word (fade, no color):', allExpectedWords[i], 'at index', i);
                      }
                    } else {
                      // Matched word - queue as spoken
                      queueWordAction('spoken', i, allExpectedWords[i]);
                      console.log('✓ Matched word spoken:', allExpectedWords[i], 'at index', i);
                    }
                  }
                  
                  currentIdx = currentIdx + lookAhead + 1;
                  lastWordTimeRef.current = Date.now();
                  clearHints();
                  
                  if (currentIdx < allExpectedWords.length) {
                    startProgressiveHints(currentIdx, allExpectedWords, allExpectedWordsRaw);
                  }
                  break;
                }
              }
              
              if (!matchFound) {
                // Handle support word case - only advance if user was shown the word
                if (wasSupportWordShowing && previousSupportWordIndex !== null) {
                  // Only hidden words can be marked as hesitated (yellow)
                  // First word of speech can NEVER be marked yellow
                  if (currentHiddenIndices.has(previousSupportWordIndex) && previousSupportWordIndex !== 0) {
                    // Check if already marked as hesitated - keep it yellow, don't change to red
                    if (!hesitatedWordsIndices.has(previousSupportWordIndex)) {
                      queueWordAction('hesitated', previousSupportWordIndex, allExpectedWords[previousSupportWordIndex]);
                      console.log('⚠️ Hidden support word - marking as hesitated (yellow):', allExpectedWords[previousSupportWordIndex]);
                    } else {
                      console.log('⚠️ Hidden support word already hesitated (yellow):', allExpectedWords[previousSupportWordIndex]);
                    }
                  } else if (previousSupportWordIndex === 0) {
                    console.log('⚠️ First word support - not marking (protected)');
                  }
                  currentIdx = previousSupportWordIndex + 1;
                  if (currentIdx < allExpectedWords.length) {
                    startProgressiveHints(currentIdx, allExpectedWords, allExpectedWordsRaw);
                  }
                }
                // IMPORTANT: Do NOT skip words when no match found!
                // Just log and wait for the user to say the correct word
                console.log('⏳ No match - waiting for correct word:', expectedWord, 'at index', currentIdx);
              }
            }
          }
          
          // Update refs and state
          expectedWordIndexRef.current = currentIdx;
          processedTranscriptLengthRef.current = transcriptWords.length;
          setExpectedWordIndex(currentIdx);
          setLastProcessedTranscriptLength(transcriptWords.length);
        };
        
        recognition.onerror = (event: any) => {
          console.error('❌ Speech recognition error:', event.error, event);
          if (event.error === 'no-speech') {
            console.log('⚠️ No speech detected, continuing...');
          }
        };
        
        recognition.onstart = () => {
          console.log('🎤 Speech recognition STARTED successfully');
        };
        
        recognition.onend = () => {
          console.log('🛑 Speech recognition ENDED');
        };
        
        try {
          recognition.start();
          recognitionRef.current = recognition;
          console.log('✨ Web Speech API started for instant word tracking');
        } catch (startError) {
          console.error('❌ Error starting recognition:', startError);
        }
      } else {
        console.warn('⚠️ Web Speech API not supported on this device');
        toast({
          title: t('practice.limitedSupport'),
          description: t('practice.limitedSupportDesc'),
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('❌ Error in handleRecordingStart:', error);
    }
  };

  const handleRecordingStop = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsProcessing(true);
    
    // Clear hesitation timer first to prevent more yellow markings
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    // Clear hint timer
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    
    // IMPORTANT: Wait a moment for Web Speech API to deliver final results
    // before stopping it - this ensures the last spoken words are captured
    await new Promise<void>((resolve) => {
      // Give Web Speech API 800ms to deliver any pending results
      setTimeout(() => {
        // Now stop Web Speech API
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore errors if already stopped
          }
          recognitionRef.current = null;
        }
        resolve();
      }, 800);
    });
    
    // Process any remaining items in the word queue before clearing
    // Wait for queue to finish processing
    if (wordQueueRef.current.length > 0) {
      console.log('⏳ Processing remaining', wordQueueRef.current.length, 'words in queue...');
      await new Promise<void>((resolve) => {
        const checkQueue = () => {
          if (wordQueueRef.current.length === 0 || !isProcessingQueueRef.current) {
            resolve();
          } else {
            setTimeout(checkQueue, 50);
          }
        };
        // Give it max 500ms to finish
        setTimeout(resolve, 500);
        checkQueue();
      });
    }
    
    // NOW clear word processing queue
    wordQueueRef.current = [];
    isProcessingQueueRef.current = false;
    if (queueProcessorTimeoutRef.current) {
      clearTimeout(queueProcessorTimeoutRef.current);
      queueProcessorTimeoutRef.current = null;
    }
    
    // Clear the transcription interval
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    lastProcessedChunkIndex.current = 0;
    
    // KEEP real-time tracking data for results display
    // Use REFS (not state) to avoid stale closure issues
    const realtimeMissedIndices = new Set(missedWordsIndicesRef.current);
    const realtimeHesitatedIndices = new Set(hesitatedWordsIndicesRef.current);
    const realtimeSpokenIndices = new Set(spokenWordsIndicesRef.current);
    
    console.log('📊 Captured real-time tracking for results:',
      'missed:', [...realtimeMissedIndices],
      'hesitated:', [...realtimeHesitatedIndices],
      'spoken:', [...realtimeSpokenIndices]
    );
    setSegmentErrors(new Map());
    setSegmentHesitations(new Map());
    setExpectedWordIndex(0);
    setLastProcessedTranscriptLength(0);

    // Scroll to results area
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);

    try {
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('No audio data recorded. Please try again.');
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          if (!base64Audio) {
            throw new Error('Failed to process audio. Please try again.');
          }

          toast({
            title: "Processing...",
            description: "AI is analyzing your practice lesson",
          });

          // Use stored speech language directly - no re-detection
          const speechLanguage = speech?.speech_language || 'en';
          console.log('Using stored speech language for analysis:', speechLanguage);

          // Get current session for auth
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('No active session. Please log in again.');
          }

          // Call the edge function with auth token
          const { data, error } = await supabase.functions.invoke('analyze-speech', {
            body: {
              audio: base64Audio,
              originalText: cleanBracketNotation(activeSegmentText || speech!.text_original),
              speechId: speech!.id,
              userTier: subscriptionTier,
              language: speechLanguage,
              skillLevel: skillLevel,
              strictness: (speech as any)?.practice_strictness ?? 'strict',
              learningMode: speech?.learning_mode ?? 'word_by_word',
              feedbackLanguage: i18n.language || speechLanguage,
            },
            headers: {
              Authorization: `Bearer ${session.access_token}`
            }
          });

          if (error) {
            console.error('Edge function error:', error);
            throw new Error(error.message || 'Failed to analyze speech');
          }

          if (!data) {
            throw new Error('No response from analysis service');
          }

          // Combine AI analysis with real-time tracking for complete results
          // Get original words for mapping indices to words
          const analysisWords = cleanBracketNotation(activeSegmentText || speech!.text_original)
            .split(/\s+/)
            .filter((w: string) => w.trim());
          
          // Convert real-time tracked indices to word strings
          const realtimeMissedWords: string[] = [];
          const realtimeHesitatedWords: string[] = [];
          
          realtimeMissedIndices.forEach(idx => {
            if (idx < analysisWords.length) {
              realtimeMissedWords.push(analysisWords[idx]);
            }
          });
          
          realtimeHesitatedIndices.forEach(idx => {
            if (idx < analysisWords.length) {
              realtimeHesitatedWords.push(analysisWords[idx]);
            }
          });
          
          // CRITICAL: ONLY use realtime tracking data for missed/hesitated words
          // The AI analysis should NOT add its own detected missed words
          // This ensures the results match exactly what the user saw during practice
          
          // Only use words that were ACTUALLY marked red/yellow in the text during practice
          const combinedMissedWords = [...realtimeMissedWords];
          const finalDelayedWords = [...realtimeHesitatedWords];
          
          // Remove any words that are in missed from hesitated (missed is more severe)
          const missedSet = new Set(combinedMissedWords.map(w => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')));
          const cleanedDelayedWords = finalDelayedWords.filter(w => 
            !missedSet.has(w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
          );
          
          console.log('📊 Realtime-only results (AI detection ignored):',
            'Missed words:', combinedMissedWords,
            'Hesitated words:', cleanedDelayedWords
          );
          
          // Build combined indices for index-based marking in PracticeResults
          const finalMissedIndices: number[] = [];
          const finalHesitatedIndices: number[] = [];
          
          realtimeMissedIndices.forEach(idx => finalMissedIndices.push(idx));
          realtimeHesitatedIndices.forEach(idx => {
            if (!finalMissedIndices.includes(idx)) {
              finalHesitatedIndices.push(idx);
            }
          });
          
          // Create enhanced results with real-time tracking data AND indices
          const enhancedResults = {
            ...data,
            missedWords: combinedMissedWords,
            delayedWords: cleanedDelayedWords,
            missedIndices: finalMissedIndices,
            hesitatedIndices: finalHesitatedIndices,
          };

          setSessionResults(enhancedResults);
          
          // Delay showing results for smooth transition
          setTimeout(() => {
            setIsProcessing(false);
            setShowResults(true);
          }, 500);

          // Save practice session to database with combined real-time + AI data
          const { error: sessionError } = await supabase
            .from('practice_sessions')
            .insert({
              speech_id: speech!.id,
              score: data.accuracy,
              missed_words: combinedMissedWords,
              delayed_words: cleanedDelayedWords,
              difficulty_score: data.difficultyScore,
              connector_words: data.connectorWords,
              duration: 0,
            });

          if (sessionError) {
            console.error('Error saving session:', sessionError);
          }

          // Update segment performance
          // Note: We update segment mastery AFTER getting the visibility from update-segment-word-mastery
          // The segment mastery update happens below after calling update-segment-word-mastery

          // Calculate hidden indices from text_current (words in brackets are hidden)
          const extractHiddenIndices = (textCurrent: string): number[] => {
            const hiddenIndices: number[] = [];
            const words = textCurrent.split(/\s+/).filter(w => w.trim());
            let originalIndex = 0;
            
            words.forEach(word => {
              if (word.startsWith('[') && word.endsWith(']')) {
                hiddenIndices.push(originalIndex);
              }
              originalIndex++;
            });
            
            return hiddenIndices;
          };

          const hiddenIndices = extractHiddenIndices(speech!.text_current || speech!.text_original);

          // Get current segment ID for segment-based tracking
          const currentSegmentId = segments.find(s => 
            activeSegmentIndices.includes(s.segment_order)
          )?.id;

          // Update segment word mastery with hidden word failure tracking
          // Map AI's missedWords (strings) back to indices for accurate tracking
          const originalWords = cleanBracketNotation(activeSegmentOriginalText || speech!.text_original)
            .split(/\s+/)
            .filter((w: string) => w.trim());
          
          const missedWordSet = new Set(
            (data.missedWords || []).map((w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
          );
          const hesitatedWordSet = new Set(
            (data.delayedWords || []).map((w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
          );
          
          // Build indices from AI's word lists
          const missedIndicesFromAI: number[] = [];
          const hesitatedIndicesFromAI: number[] = [];
          
          originalWords.forEach((word: string, idx: number) => {
            const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            if (missedWordSet.has(cleanWord)) {
              missedIndicesFromAI.push(idx);
            }
            if (hesitatedWordSet.has(cleanWord)) {
              hesitatedIndicesFromAI.push(idx);
            }
          });
          
          // Combine real-time tracking with AI analysis for best accuracy
          // Use realtimeMissedIndices/realtimeHesitatedIndices captured before reset
          const combinedMissedIndices = [...new Set([
            ...Array.from(realtimeMissedIndices),
            ...missedIndicesFromAI
          ])];
          const combinedHesitatedIndices = [...new Set([
            ...Array.from(realtimeHesitatedIndices),
            ...hesitatedIndicesFromAI
          ])];
          
          console.log('📊 Missed indices - realtime:', Array.from(realtimeMissedIndices), 'AI:', missedIndicesFromAI, 'combined:', combinedMissedIndices);
          console.log('📊 Hesitated indices - realtime:', Array.from(realtimeHesitatedIndices), 'AI:', hesitatedIndicesFromAI, 'combined:', combinedHesitatedIndices);

          // CRITICAL FIX: Call update-segment-word-mastery FIRST to get the NEW visibility percentage
          // Then use that updated visibility for the adaptive learning calculation
          let updatedVisibilityPercent = speech!.base_word_visibility_percent || 100;
          
          try {
            const { data: masteryData, error: masteryError } = await supabase.functions.invoke('update-segment-word-mastery', {
              body: {
                speechId: speech!.id,
                segmentId: currentSegmentId,
                missedWords: combinedMissedWords,
                hesitatedWords: finalDelayedWords,
                missedIndices: combinedMissedIndices,
                hesitatedIndices: combinedHesitatedIndices,
                hiddenIndices: hiddenIndices
              }
            });

            if (masteryError) {
              console.error('Error updating segment word mastery:', masteryError);
            } else {
              console.log('✅ Segment word mastery updated with combined index tracking');
              // Use the NEW visibility percent returned from mastery update
              if (masteryData && masteryData.visibilityPercent !== undefined) {
                updatedVisibilityPercent = masteryData.visibilityPercent;
                console.log('📊 Using updated visibility from mastery:', updatedVisibilityPercent + '%');
              }
              
              // ===== SEGMENT MASTERY UPDATE =====
              // Mastery criteria: 100% accuracy AND ≤10% script visibility
              // This ensures you truly memorized the segment, not just reading from script
              if (activeSegmentIndices.length > 0) {
                const segmentVisibility = masteryData?.segmentVisibility ?? updatedVisibilityPercent;
                
                for (const segmentOrder of activeSegmentIndices) {
                  const segment = segments.find(s => s.segment_order === segmentOrder);
                  if (segment) {
                    const newTimesPracticed = segment.times_practiced + 1;
                    const oldAvg = segment.average_accuracy || 0;
                    const newAvg = oldAvg === 0 
                      ? data.accuracy 
                      : (oldAvg * segment.times_practiced + data.accuracy) / newTimesPracticed;
                    
                    // NEW MASTERY CRITERIA:
                    // - 100% accuracy (or 98%+ to allow tiny margin)
                    // - Script visibility ≤10% (90%+ of words hidden)
                    const isPerfectAccuracy = data.accuracy >= 98;
                    const isLowVisibility = segmentVisibility <= 10;
                    const isMastered = isPerfectAccuracy && isLowVisibility;
                    
                    // Determine if we should mark merged_with_next
                    // This happens when the previous segment is mastered and this one becomes mastered too
                    let shouldMergeWithPrevious = false;
                    if (isMastered && segmentOrder > 0) {
                      const previousSegment = segments.find(s => s.segment_order === segmentOrder - 1);
                      if (previousSegment?.is_mastered) {
                        shouldMergeWithPrevious = true;
                      }
                    }

                    await supabase
                      .from('speech_segments')
                      .update({
                        times_practiced: newTimesPracticed,
                        average_accuracy: newAvg,
                        last_practiced_at: new Date().toISOString(),
                        is_mastered: isMastered,
                        visibility_percent: segmentVisibility,
                      })
                      .eq('id', segment.id);

                    console.log(`📊 Segment ${segmentOrder} updated: ${newTimesPracticed}x practiced, ${Math.round(newAvg)}% avg, visibility: ${segmentVisibility}%, mastered: ${isMastered}`);
                    
                    // If this segment just became mastered, show unlock message
                    if (isMastered && !segment.is_mastered) {
                      const nextSegmentExists = segments.some(s => s.segment_order === segmentOrder + 1);
                      if (nextSegmentExists) {
                        toast({
                          title: `🎯 ${t('practice.segmentMastered')}`,
                          description: t('practice.nextSegmentUnlocked'),
                          duration: 5000,
                        });
                      }
                    }
                    
                    // If we should merge with previous segment (both mastered now)
                    if (shouldMergeWithPrevious) {
                      const previousSegment = segments.find(s => s.segment_order === segmentOrder - 1);
                      if (previousSegment) {
                        await supabase
                          .from('speech_segments')
                          .update({ merged_with_next: true })
                          .eq('id', previousSegment.id);
                        
                        toast({
                          title: `🔗 ${t('practice.segmentsMerged')}`,
                          description: t('practice.practiceTogetherNow'),
                          duration: 5000,
                        });
                      }
                    }
                  }
                }

                // Reload segments to update active segments
                const { data: updatedSegments } = await supabase
                  .from("speech_segments")
                  .select("*")
                  .eq("speech_id", id)
                  .order("segment_order", { ascending: true });

                if (updatedSegments) {
                  setSegments(updatedSegments);
                  determineActiveSegments(updatedSegments);
                }
              }
            }
          } catch (err) {
            console.error('Failed to update segment word mastery:', err);
          }

          // AUTOMATIC SCHEDULING: Call adaptive learning with the UPDATED visibility percentage
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (authSession) {
              const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('update-adaptive-learning', {
                body: {
                  speechId: speech!.id,
                  sessionAccuracy: data.accuracy,
                  wordVisibilityPercent: updatedVisibilityPercent // Use the NEW visibility, not the old one
                },
                headers: {
                  Authorization: `Bearer ${authSession.access_token}`
                }
              });

              if (scheduleError) {
                console.error('Error updating adaptive schedule:', scheduleError);
              } else if (scheduleData) {
                console.log('📊 Adaptive schedule updated:', scheduleData);
                setAdaptiveScheduleResult({
                  intervalMinutes: scheduleData.intervalMinutes,
                  nextReviewDate: scheduleData.nextReviewDate,
                  weightedAccuracy: scheduleData.weightedAccuracy,
                  wordVisibility: scheduleData.wordVisibility,
                  recommendation: scheduleData.recommendation,
                  learningStage: scheduleData.learningStage
                });
                
                // Update lock state with new AI-recommended time
                if (scheduleData.nextReviewDate) {
                  setNextReviewDate(new Date(scheduleData.nextReviewDate));
                  setIsLocked(true);
                }
              }
            }
          } catch (err) {
            console.error('Failed to update adaptive schedule:', err);
          }

          // Don't overwrite the main script with AI cue text.
          // Cue text is used only for analysis display, while
          // progressive word hiding is driven by the adaptive mastery system.

          toast({
            title: t('practice.analysisComplete'),
            description: t('practice.accuracyPercent', { percent: data.accuracy }),
          });
          
          // Reset tracking state and refs after all processing is complete
          setSpokenWordsIndices(new Set());
          setHesitatedWordsIndices(new Set());
          setMissedWordsIndices(new Set());
          spokenWordsIndicesRef.current = new Set();
          hesitatedWordsIndicesRef.current = new Set();
          missedWordsIndicesRef.current = new Set();
          setCompletedSegments(new Set());
        } catch (innerError: any) {
          console.error('Error in analysis:', innerError);
          toast({
            variant: "destructive",
            title: t('practice.analysisFailed'),
            description: innerError.message || t('practice.analysisFailedDesc'),
          });
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: t('practice.processingFailed'),
          description: t('practice.processingFailedDesc'),
        });
        setIsProcessing(false);
      };

    } catch (error: any) {
      console.error('Error processing recording:', error);
      toast({
        variant: "destructive",
        title: t('practice.processingFailed'),
        description: error.message || t('practice.processingFailedDesc'),
      });
      setIsProcessing(false);
    }
  };

  const handleNewSession = () => {
    setShowResults(false);
    setSessionResults(null);
    setIsPracticing(false);
    setAdaptiveScheduleResult(null);
  };

  const handleOpenEditScript = () => {
    if (speech) {
      setEditedScriptText(speech.text_original);
      setIsEditingScript(true);
    }
  };

  const handleOpenSpeechSettings = () => {
    if (!speech) return;
    setEditingLearningMode(speech.learning_mode || 'word_by_word');
    setEditingDeadline(speech.goal_date ? new Date(speech.goal_date) : undefined);
    setShowSpeechSettings(true);
  };

  const handleSaveSpeechSettings = async () => {
    if (!speech || !editingDeadline) return;

    try {
      const newGoalDate = format(editingDeadline, "yyyy-MM-dd");
      const { error } = await supabase
        .from('speeches')
        .update({
          learning_mode: editingLearningMode,
          goal_date: newGoalDate,
        })
        .eq('id', speech.id);

      if (error) throw error;

      toast({
        title: t('common.success', 'Success'),
        description: t('dashboard.deadlineUpdated', 'Speech settings updated'),
      });

      setSpeech(prev => prev ? {
        ...prev,
        learning_mode: editingLearningMode,
        goal_date: newGoalDate,
      } : prev);
      setShowSpeechSettings(false);
      loadSpeech();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('practice.failedToSave'),
        description: error.message,
      });
    }
  };

  const handleSaveScript = async () => {
    if (!speech || !editedScriptText.trim()) return;
    
    try {
      const trimmedText = editedScriptText.trim();

      const { error } = await supabase
        .from('speeches')
        .update({ 
          text_original: trimmedText,
        })
        .eq('id', speech.id);
      
      if (error) throw error;
      
      const { data: existingSegments } = await supabase
        .from('speech_segments')
        .select('*')
        .eq('speech_id', speech.id)
        .order('segment_order', { ascending: true });
      
      if (existingSegments && existingSegments.length > 0) {
        const newWordCount = trimmedText.split(/\s+/).length;
        
        if (existingSegments.length === 1) {
          await supabase
            .from('speech_segments')
            .update({
              segment_text: trimmedText,
              end_word_index: newWordCount - 1,
            })
            .eq('id', existingSegments[0].id);
        } else {
          await supabase
            .from('speech_segments')
            .update({
              segment_text: trimmedText,
              end_word_index: newWordCount - 1,
            })
            .eq('id', existingSegments[0].id);
        }
      } else {
        await supabase
          .from('speech_segments')
          .insert({
            speech_id: speech.id,
            segment_order: 0,
            segment_text: trimmedText,
            start_word_index: 0,
            end_word_index: trimmedText.split(/\s+/).length - 1,
            is_mastered: false,
            times_practiced: 0
          });
      }
      
      toast({
        title: t('practice.scriptUpdated'),
        description: t('practice.scriptUpdatedDesc'),
      });
      
      setIsEditingScript(false);
      setSpeech(prev => prev ? { ...prev, text_original: trimmedText } : prev);
      setActiveSegmentText(trimmedText);
      setActiveSegmentOriginalText(trimmedText);
      loadSpeech();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('practice.failedToSave'),
        description: error.message,
      });
    }
  };


  if (loading) {
    return <div className="s-gi s-mn" />;
  }

  // A failed load (e.g. "Load failed" on a flaky connection) used to leave a
  // blank, untappable screen. Always offer retry and a way back.
  if (!speech) {
    return (
      <div className="practice-loading s-gi">
        <div className="practice-loading__bar" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="s-dn">
            <ArrowLeft className="s-fz s-xt" />
            {t('common.back')}
          </Button>
        </div>
        <div className="practice-loading__body">
          <p className="practice-loading__text">{t('practice.loadFailed')}</p>
          <Button onClick={() => { setLoading(true); void loadSpeech(); }}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }


  // Day-After Recall Mode
  if (isDayAfterRecall && !showResults) {
    return (
      <div className="s-gi s-3v s-c5 s-c7 s-mn">
        {/* Minimal header with exit */}
        <header className="s-c5 s-ib s-if s-mw s-6v s-70" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsDayAfterRecall(false);
            }}
            className="s-dn"
          >
            <ArrowLeft className="s-fz s-xt" />
            {t('common.exit')}
          </Button>
          <h1 className="s-v9 s-d0 s-ul truncate s-jk">
            {speech.title}
          </h1>
          <div className="s-xj" />
        </header>
        
        <div className="s-c6 s-c5 s-c7">
          <DayAfterRecallView
            speechId={speech.id}
            onComplete={() => {
              setIsDayAfterRecall(false);
              toast({
                title: t('day_after_recall.stable'),
                description: t('day_after_recall.stable_desc'),
              });
            }}
            onExit={() => {
              setIsDayAfterRecall(false);
            }}
          />
        </div>
      </div>
    );
  }

  // Focus Mode: Beat-based sentence-by-sentence practice
  if (isPracticing && !showResults) {
    return (
      <div className="s-gi s-3v s-c5 s-c7">
        {/* Full-height beat practice - BeatPracticeView has its own header */}
        <div className="s-c6 s-c5 s-c7">
          <BeatPracticeView
            speechId={speech.id}
            subscriptionTier={subscriptionTier}
            fullSpeechText={speech.text_original}
            speechLanguage={speech.speech_language}
            learningMode={speech.learning_mode}
            onComplete={async () => {
              setIsPracticing(false);
              // Ensure schedule is written with future date, then reload
              await ensureNextPracticeScheduled();
              loadSpeech();
              toast({
                title: t('beat_practice.beat_complete'),
                description: "All beats mastered!",
              });
            }}
            onExit={() => {
              // Simply exit without setting lock - lock is only set when beat is mastered
              setIsPracticing(false);
              setIsRecording(false);
              // Don't call ensureNextPracticeScheduled here - only lock when beat is mastered
              loadSpeech();
            }}
            onEditScript={() => {
              // Exit practice and open the edit-script dialog with the latest text
              setIsPracticing(false);
              setIsRecording(false);
              handleOpenEditScript();
            }}
          />
        </div>
      </div>
    );
  }


  // Analysis screen: Clean, minimal results view
  if (showResults && sessionResults) {
    return (
      <div className="s-gi s-3v s-mn" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <LoadingOverlay isVisible={isProcessing} />
        
        <div className="s-26 s-iw s-ye" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="s-qe s-gv"
          >
            <X className="s-g1 s-xv" />
          </Button>
        </div>

        {/* Centered analysis content */}
        <div className="s-8j s-m9 s-os s-p2 s-je">
          <div className="s-u0 s-k2">
            <h1 className="s-ta s-cx s-jy">{t('practice.results.title')}</h1>
            <p className="s-uk s-ul">{t('practice.results.feedback')}</p>
          </div>

          <div ref={resultsRef} className="s-2y">
            <PracticeResults
              accuracy={sessionResults.accuracy}
              missedWords={sessionResults.missedWords}
              delayedWords={sessionResults.delayedWords}
              analysis={sessionResults.analysis}
              transcription={sessionResults.transcription}
              originalText={activeSegmentOriginalText || speech.text_original}
              currentText={activeSegmentText || speech.text_current}
              missedIndices={sessionResults.missedIndices}
              hesitatedIndices={sessionResults.hesitatedIndices}
            />
          </div>

          {/* Automatic Schedule Info */}
          {adaptiveScheduleResult && (
            <Card className="s-m1 s-7r s-5e s-2y">
              <CardContent className="s-of">
                <div className="s-u0 s-t1">
                  <div className="s-c5 s-ib s-ig s-dn s-uw">
                    <Target className="s-g1 s-xv" />
                    <span className="s-d3 s-uk">{t('practice.nextPractice')}</span>
                  </div>
                  
                  <div className="s-ta s-cx">
                    {adaptiveScheduleResult.intervalMinutes < 60 
                      ? `${Math.round(adaptiveScheduleResult.intervalMinutes)} min`
                      : adaptiveScheduleResult.intervalMinutes < 24 * 60
                      ? `${(adaptiveScheduleResult.intervalMinutes / 60).toFixed(1)} hours`
                      : `${(adaptiveScheduleResult.intervalMinutes / (24 * 60)).toFixed(1)} days`}
                  </div>
                  
                  <p className="s-v9 s-ul s-jq s-m9">
                    {adaptiveScheduleResult.recommendation}
                  </p>

                  <div className="s-e0 s-e3 s-dq s-od s-82 s-70">
                    <div className="s-u0">
                      <div className="s-c5 s-ib s-ig s-dl s-ul s-jw">
                        <Target className="s-fw s-xp" />
                        <span className="s-vj">{t('practice.weightedScore')}</span>
                      </div>
                      <span className="s-d3">{Math.round(adaptiveScheduleResult.weightedAccuracy)}%</span>
                    </div>
                    <div className="s-u0">
                      <div className="s-c5 s-ib s-ig s-dl s-ul s-jw">
                        <Eye className="s-fw s-xp" />
                        <span className="s-vj">{t('practice.scriptVisible')}</span>
                      </div>
                      <span className="s-d3">{Math.round(speech.base_word_visibility_percent || 100)}%</span>
                    </div>
                    <div className="s-u0">
                      <div className="s-c5 s-ib s-ig s-dl s-ul s-jw">
                        <Target className="s-fw s-xp" />
                        <span className="s-vj">{t('practice.stage')}</span>
                      </div>
                      <span className="s-d3 s-8i">{adaptiveScheduleResult.learningStage}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          <div className="s-c5 s-ig s-m1">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="s-qe s-ov"
            >
              <ArrowLeft className="s-fz s-xt s-lp" />
              {t('practice.results.dashboard')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-practice screen: Beat-focused start screen
  // Use practiceBeats for accurate counts, fall back to segments if no practice_beats exist
  const masteredBeats = practiceBeats.length > 0 
    ? practiceBeats.filter(b => b.is_mastered).length 
    : segments.filter(s => s.is_mastered).length;
  const totalBeats = practiceBeats.length > 0 ? practiceBeats.length : segments.length;
  const progressPercent = totalBeats > 0 ? (masteredBeats / totalBeats) * 100 : 0;
  // Mastery = % of beats that have been mastered at least once (clean rep with all words hidden).
  // This is achievable even when speech recognition mishears individual word tokens.
  const masteryPercent = totalBeats > 0
    ? Math.round((masteredBeats / totalBeats) * 100)
    : 0;
  const nextBeatNumber = masteredBeats + 1;
  const hasBeats = totalBeats > 0;

  // Fully complete: every beat mastered AND the deadline has passed.
  // In this state repetition is voluntary — no locks, countdowns or warnings.
  const isFullyComplete =
    masteryPercent >= 100 &&
    !!speech?.goal_date &&
    new Date(speech.goal_date).getTime() < Date.now();
  const isLockedEffective = isLocked && !isFullyComplete;

  return (
    <div className="s-gi s-3v s-c5 s-c7 s-mm">
      <LoadingOverlay isVisible={isProcessing} />
      
      {/* Duolingo-style header with progress bar */}
      <header className="s-t7 s-w1 s-ye s-3v s-6v s-6y" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}>
        <div className="s-8j s-m9 s-os s-p6">
          <div className="s-c5 s-ib s-dp">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="s-r5 s-qe s-h0"
            >
              <X className="s-g1 s-xv s-ul" />
            </Button>
            
            <div className="s-c6">
              <div className="s-fw s-50 s-qe s-mn">
                <div 
                  className="s-gg s-5c s-qe s-wr s-br s-bu"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            <div className="s-c5 s-ib s-dl s-r5">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("keycards.print", "Print or share")}
                onClick={() => speech && printSpeechKeycards(speech.id, speech.text_original, t as never)}
                className="s-qe"
              >
                <Printer className="s-fz s-xt" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/presentation/${id}`)}
                className="s-qe"
              >
                <Presentation className="s-fz s-xt" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="s-qe">
                    <Settings className="s-xt s-fz" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="s-xx">
                  <DropdownMenuLabel>{t('practice.settings.title')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div
                    className="s-op s-p3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <HesitationSliderControl />
                  </div>
                  <DropdownMenuSeparator />
                  {subscriptionTier !== 'free' && (
                    <DropdownMenuItem onClick={handleOpenEditScript}>
                      <Pencil className="s-lp s-fz s-xt" />
                      {t('practice.editScriptTitle')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleOpenSpeechSettings}>
                    <Settings className="s-lp s-fz s-xt" />
                    {t('nav.settings')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - centered and focused */}
      <main className="s-c6 s-c5 s-c7 s-ib s-ii s-os s-od s-n7">
        <div className="s-y7 s-jq s-t1">

          {/* Compact hero — title + goal in a tight stack, no oversized mascot */}
          {speech && (
            <div className="s-u0 s-sw s-o7">
              <h1 className="s-vi s-d3 s-wh truncate">{speech.title}</h1>
              {speech.goal_date && (
                <p className="s-vj s-ul">
                  {t('practice.goal')}: {dateFormatter(i18n.language, { dateStyle: 'long' }).format(new Date(speech.goal_date))}
                </p>
              )}
            </div>
          )}

          {/* Compact inline stat row — no SVG arcs, Apple-style density */}
          <div className="s-c5 s-ib s-ig s-ds s-oy">
            <div className="s-c5 s-c7 s-ib">
              <span className="s-vi s-d3 tabular-nums">{masteredBeats}</span>
              <span className="s-tl s-x1 s-wi s-ul">{t('beat_practice.learned')}</span>
            </div>
            <div className="s-g6 s-y9 s-4a" />
            <div className="s-c5 s-c7 s-ib">
              <span className="s-vi s-d3 tabular-nums s-uw">{masteryPercent}%</span>
              <span className="s-tl s-x1 s-wi s-ul">{t('playful.completed')}</span>
            </div>
            <div className="s-g6 s-y9 s-4a" />
            <div className="s-c5 s-c7 s-ib">
              <span className="s-vi s-d3 tabular-nums">{totalBeats - masteredBeats}</span>
              <span className="s-tl s-x1 s-wi s-ul">{t('beat_practice.remaining')}</span>
            </div>
          </div>


          {/* Fully complete card — speech mastered and deadline passed */}
          {isFullyComplete && (
            <div className="s-pd s-mn s-qa s-6l s-71 s-5e s-my s-r3 s-u0 s-t0">
              <div className="s-m9 s-xi s-fq s-qe s-5e s-pl s-py s-c5 s-ib s-ig">
                <CheckCircle2 className="s-g4 s-xy s-uw" />
              </div>
              <h2 className="s-uk s-cx">{t('practice.speech_complete_title', 'You know your speech!')}</h2>
              <p className="s-v9 s-ul s-iq">
                {t('practice.speech_complete_desc', 'All parts are mastered and your deadline has passed. Great job!')}
              </p>
            </div>
          )}

          {/* Session Card - only show for active (non-complete) sessions */}
          {!todaySessionDone && !isFullyComplete && (
            <div className="s-pd s-mn s-qa s-6l s-71 s-5e s-mx s-r3">
              <div className="s-c5 s-ib s-dp">
                <div className="s-xg s-fo s-q9 s-c5 s-ib s-ig s-5e s-pl s-py">
                  <Target className="s-g1 s-xv s-uw" />
                </div>
                <div className="s-c6 s-l8">
                  <h3 className="s-d3 s-ir">
                    {masteredBeats === 0
                      ? t('beat_practice.todays_session')
                      : t('beat_practice.active_session')}
                  </h3>
                  <p className="s-vj s-ul s-iq">
                    {masteredBeats > 0
                      ? t('beat_practice.session_desc_recall')
                      : t('beat_practice.session_desc_start')}
                  </p>
                </div>
              </div>

              {(masteredBeats > 0 || nextBeatNumber <= totalBeats) && (
                <div className="s-c5 s-cb s-dm s-lx">
                  {masteredBeats > 0 && (
                    <span className="s-i4 s-ib s-dm s-oq s-oy s-qe s-3s s-tu s-8p s-tm s-d0">
                      <RotateCcw className="s-fw s-xp" />
                      {masteredBeats} {t('beat_practice.to_recall')}
                    </span>
                  )}
                  {nextBeatNumber <= totalBeats && (
                    <span className="s-i4 s-ib s-dm s-oq s-oy s-qe s-5e s-uw s-tm s-d0">
                      <Flame className="s-fw s-xp" />
                      {t('beat_practice.beat_to_learn', { num: nextBeatNumber })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Beat Timeline - horizontal dots with connecting progress track */}
          {hasBeats && (
            <div className="s-o9 s-n1">
              <div className="s-c5 s-ib s-if s-jy s-ol">
                <span className="s-tl s-x1 s-wj s-ul s-d0">
                  {t('beat_practice.beats', 'Beats')}
                </span>
                <span className="s-tl s-x1 s-wj s-ul s-d0 tabular-nums">
                  {masteredBeats}/{totalBeats}
                </span>
              </div>
              <div className="s-pd">
                {/* Track */}
                <div className="s-26 s-iw s-pi s-w4 s-9 s-fk s-50 s-qe" />
                <div
                  className="s-26 s-iw s-w4 s-9 s-fk s-5c s-qe s-wr s-bq"
                  style={{
                    width: totalBeats > 1
                      ? `calc((100% - 2rem) * ${Math.min(masteredBeats / (totalBeats - 1), 1)})`
                      : masteredBeats > 0 ? 'calc(100% - 2rem)' : '0px'
                  }}
                />
                <div className="s-pd s-c5 s-ib s-if">
                  {segments.map((segment, idx) => {
                    const isCurrent = !segment.is_mastered && idx === masteredBeats;
                    const isLast = idx === totalBeats - 1;
                    const showSmallDot = idx > masteredBeats && !isLast;

                    if (showSmallDot) {
                      return (
                        <div
                          key={segment.id}
                          className="s-pd s-ye s-y0 s-g6 s-qe s-c5 s-ib s-ig"
                        >
                          <div className="s-xk s-fs s-qe s-51" />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={segment.id}
                        className={`
                          s-pd s-ye s-y0 s-g6 s-qe s-c5 s-ib s-ig s-vj s-d3 s-wr
                          ${segment.is_mastered
                            ? 's-5c s-ux s-r3 s-r1'
                            : isCurrent
                              ? 's-3v s-uw s-6n s-7n s-pn s-px'
                              : 's-50 s-ul s-6l s-6x'}
                        `}
                      >
                        {segment.is_mastered ? (
                          <CheckCircle2 className="s-fz s-xt" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Next session info moved into the fixed bottom bar for a single-screen layout */}

        </div>
      </main>

      {/* Fixed bottom CTA - Duolingo style */}
        <div className="s-c4 s-8b s-is s-pe s-os s-oc s-n9 s-43 s-3f s-82 s-6z" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
          <div className="s-jq s-m9 s-sy">
            {isFullyComplete ? (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="s-y7 s-fq s-q9 s-uk s-cx s-qx s-r0 s-hr s-wr"
                >
                  <CheckCircle2 className="s-g1 s-xv s-lp" />
                  {t('practice.back_to_overview', 'Back to overview')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate(`/presentation/${id}`)}
                  className="s-y7 s-fp s-q9 s-d3"
                >
                  <Presentation className="s-fz s-xt s-lp" />
                  {t('practice.rehearse_presentation', 'Rehearse for the big day')}
                </Button>
              </>
            ) : todaySessionDone ? (
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className={`s-y7 s-fq s-q9 s-uk s-cx s-3v ${masteryPercent >= 100 ? 's-7e s-ue s-gz' : 's-6t s-tu s-gs'}`}
              >
              {masteryPercent >= 100 ? <CheckCircle2 className="s-g1 s-xv s-lp" /> : <Clock className="s-g1 s-xv s-lp" />}
              {nextReviewDate && nextReviewDate.toDateString() === new Date().toDateString()
                ? t('beat_practice.done_for_now', "Done for now!")
                : t('beat_practice.done_for_today', "Done for today!")}
            </Button>
          ) : (
            <Button 
              size="lg" 
              onClick={() => handleStartPractice()}
              disabled={isLockedEffective}
              className="s-y7 s-fq s-q9 s-uk s-cx s-qx s-r0 s-hr s-wr"
            >
              <Play className="s-g1 s-xv s-lp" />
              {isLockedEffective 
                ? t('practice.locked') 
                : masteredBeats === 0
                  ? t('beat_practice.start_session', 'Start Session')
                  : t('beat_practice.start_next_session')}
            </Button>
          )}

          {/* Secondary CTA: practice anyway link, only while the speech is still being learned */}
          {isLockedEffective && nextReviewDate && (
            <button
              type="button"
              onClick={() => setShowTimingWarning(true)}
              className="s-m9 s-c5 s-ib s-dm s-v9 s-ul s-x0 s-i1 s-hv s-ws s-o7"
            >
              <Clock className="s-fx s-xq" />
              {t('practice.practiceAnyway')}
            </button>
          )}
        </div>
      </div>


      {/* Premium User Timing Warning Dialog */}
      <AlertDialog open={showTimingWarning} onOpenChange={setShowTimingWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="s-c5 s-ib s-dn">
              <AlertTriangle className="s-g1 s-xv s-tt" />
              {t('practice.practicingEarly')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="s-t0">
                <p>
                  {t('practice.aiRecommendsWaiting')}<strong><LockCountdown nextReviewDate={nextReviewDate!} /></strong>
                </p>
                <p className="s-ul">
                  {t('practice.spacedRepetitionEffective')}
                </p>
                <div className="s-c5 s-id s-dn s-mv s-qh s-3s s-6l s-6s s-ly">
                  <AlertTriangle className="s-fz s-xt s-tt s-r5 s-ls" />
                  <p className="s-vj s-tv s-8p">
                    {t('practice.practiceAnywayWarning', 'Practicing early may reduce long-term retention. Use this sparingly for best results.')}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('practice.waitForOptimal')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleStartPractice(true)}>
              {t('practice.practiceNowAnyway')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Script Dialog */}
      <Dialog open={isEditingScript} onOpenChange={setIsEditingScript}>
        <DialogContent className="s-jc s-j9 s-mq">
          <DialogHeader className="s-ny">
            <DialogTitle>{t('practice.editScriptTitle')}</DialogTitle>
            <DialogDescription>
              {t('practice.editScriptDesc')}
            </DialogDescription>
          </DialogHeader>
          <PropCueTextarea
            value={editedScriptText}
            onChange={setEditedScriptText}
            rows={12}
            className="s-l2 s-v9"
            placeholder={t('practice.enterSpeechText')}
          />
          <div className="s-lx">
            <PauseSlidersList
              text={editedScriptText}
              onChange={setEditedScriptText}
            />
          </div>
          <DialogFooter className="s-dn">
            <Button variant="outline" onClick={() => setIsEditingScript(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveScript}>
              {t('practice.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSpeechSettings} onOpenChange={setShowSpeechSettings}>
        <DialogContent className="s-jc s-j9 s-mq">
          <DialogHeader className="s-ny">
            <DialogTitle>{t('nav.settings')}</DialogTitle>
            <DialogDescription>
              {t('practice.speechSettingsDesc', 'Update practice mode and deadline.')}
            </DialogDescription>
          </DialogHeader>

          <div className="s-t3">
            <LearningModeSelector value={editingLearningMode} onChange={setEditingLearningMode} />

            <div className="s-sy">
              <label className="s-v9 s-d0">{t('upload.goalDate', 'Deadline')}</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="s-y7 s-ii s-uj s-d2"
                  >
                    <CalendarIcon className="s-lp s-fz s-xt" />
                    {editingDeadline ? dateFormatter(i18n.language, { dateStyle: 'long' }).format(editingDeadline) : <span>{t('upload.goalDate', 'Select deadline')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="s-y6 s-mr" align="start">
                  <Calendar
                    mode="single"
                    selected={editingDeadline}
                    onSelect={setEditingDeadline}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="s-dn">
            <Button variant="outline" onClick={() => setShowSpeechSettings(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveSpeechSettings} disabled={!editingDeadline}>
              {t('practice.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spaced Repetition Info Dialog */}
      <AlertDialog open={showSpacedRepetitionInfo} onOpenChange={setShowSpacedRepetitionInfo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="s-c5 s-ib s-dn">
              <GraduationCap className="s-g1 s-xv s-uw" />
              {t('practice.spacedRepetitionTitle', 'Spaced Repetition Learning')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="s-t1">
                <p className="s-u9">
                  {t('practice.spacedRepetitionExplain', 'This app uses spaced repetition - a scientifically proven method that optimizes your memory retention.')}
                </p>
                
                <div className="s-sy">
                  <div className="s-c5 s-id s-dn">
                    <CheckCircle2 className="s-fz s-xt s-uw s-r5 s-ls" />
                    <p className="s-v9 s-ul">
                      {t('practice.spacedBenefit1', 'Reviews are scheduled at optimal intervals for long-term memory')}
                    </p>
                  </div>
                  <div className="s-c5 s-id s-dn">
                    <CheckCircle2 className="s-fz s-xt s-uw s-r5 s-ls" />
                    <p className="s-v9 s-ul">
                      {t('practice.spacedBenefit2', 'Practicing too early can reduce retention effectiveness')}
                    </p>
                  </div>
                  <div className="s-c5 s-id s-dn">
                    <CheckCircle2 className="s-fz s-xt s-uw s-r5 s-ls" />
                    <p className="s-v9 s-ul">
                      {t('practice.spacedBenefit3', 'Trust the AI scheduling for best results')}
                    </p>
                  </div>
                </div>

                <div className="s-c5 s-id s-dn s-mv s-qh s-3s s-6l s-6s">
                  <AlertTriangle className="s-fz s-xt s-tt s-r5 s-ls" />
                  <p className="s-vj s-tv s-8p">
                    {t('practice.spacedWarning', 'Recalling too early disrupts the memory consolidation process and may weaken long-term retention.')}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="s-c7 s-rj s-dn">
            <AlertDialogCancel onClick={handleSpacedRepetitionPracticeAnyway} className="s-7j">
              {t('practice.practiceAnyway', 'Practice Anyway')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSpacedRepetitionContinue}>
              {t('common.okay', 'Okay')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Knowledge test for users who already know part of the speech */}
      {speech && (
        <KnowledgeTestDialog
          open={showKnowledgeTest}
          onClose={() => setShowKnowledgeTest(false)}
          speechId={speech.id}
          onCompleted={() => {
            setSpeech((s) =>
              s ? { ...s, knowledge_test_completed_at: new Date().toISOString() } : s
            );
            setShowKnowledgeTest(false);
            // Continue into the practice session automatically
            setTimeout(() => handleStartPractice(false, false, false, true), 50);
          }}
        />
      )}


    </div>
  );
};


// Inline control: lets the speaker tune how long they get before a hidden
// word is marked as a hesitation. Persisted via localStorage so the
// preference survives reloads and applies to every speech.
const HesitationSliderControl = () => {
  const { t } = useTranslation();
  const [valueMs, setValueMs] = useState<number>(() => getHesitationThresholdMs());

  return (
    <div className="s-sy">
      <div className="s-c5 s-ib s-if s-vj">
        <span className="s-d0 s-u9">
          {t('practice.settings.hesitationTime', 'Hesitation time')}
        </span>
        <span className="tabular-nums s-ul">
          {(valueMs / 1000).toFixed(1)}s
        </span>
      </div>
      <Slider
        min={MIN_HESITATION_MS}
        max={MAX_HESITATION_MS}
        step={250}
        value={[valueMs]}
        onValueChange={([v]) => {
          setValueMs(v);
          setHesitationThresholdMs(v);
        }}
      />
    </div>
  );
};

export default Practice;

