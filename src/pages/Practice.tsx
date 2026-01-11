import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw, Presentation, X, Square, Eye, Target, Pencil, Clock, Lock, Crown, AlertTriangle, Brain, Sparkles, ChevronRight, CheckCircle2, Circle, Zap, Sunrise } from "lucide-react";
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
import AudioRecorder, { AudioRecorderHandle } from "@/components/AudioRecorder";
import WordHighlighter from "@/components/WordHighlighter";
import PracticeResults from "@/components/PracticeResults";
import EnhancedWordTracker from "@/components/EnhancedWordTracker";
import BracketedTextDisplay from "@/components/BracketedTextDisplay";
// PracticeSettings removed - not used in new beat-based system
import LoadingOverlay from "@/components/LoadingOverlay";
import LockCountdown from "@/components/LockCountdown";
import BeatPracticeView from "@/components/BeatPracticeView";
import DayAfterRecallView from "@/components/DayAfterRecallView";

import SegmentProgress from "@/components/SegmentProgress";
import { useTheme } from "@/contexts/ThemeContext";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  base_word_visibility_percent: number | null;
  speech_language: string | null;
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
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [isLocked, setIsLocked] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editedScriptText, setEditedScriptText] = useState("");
  const [showTimingWarning, setShowTimingWarning] = useState(false);
  const [showSpacedRepetitionInfo, setShowSpacedRepetitionInfo] = useState(false);
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);
  const [showSessionComplete, setShowSessionComplete] = useState(false);
  const [todaySessionDone, setTodaySessionDone] = useState(false);
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
  const queueProcessorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
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
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedChunkIndex = useRef(0);
  const recognitionRef = useRef<any>(null);
  const audioFormatRef = useRef<string>('audio/webm');

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, skill_level")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
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

  // Clean bracket notation from text (keep words, remove [ and ])
  const cleanBracketNotation = (text: string): string => {
    return text.replace(/\[|\]/g, '');
  };

  // Extract hidden word indices from segment text (words inside [...] are hidden)
  const extractHiddenIndices = (text: string): Set<number> => {
    const hiddenIndices = new Set<number>();
    let globalWordIndex = 0;
    
    // Split by bracket boundaries
    const parts = text.split(/(\[[^\]]*\])/);
    
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
    loadSpeech();
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
      const { data: schedule } = await supabase
        .from("schedules")
        .select("next_review_date")
        .eq("speech_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
        
      if (schedule?.next_review_date) {
        const reviewDate = new Date(schedule.next_review_date);
        setNextReviewDate(reviewDate);
        
        // Lock if review date is in future
        if (reviewDate > new Date()) {
          setIsLocked(true);
          console.log('🔒 Speech locked until AI-recommended time:', reviewDate);
        } else {
          setIsLocked(false);
        }
      }
      
      // Check if today's session is complete (beat mastered today or all beats mastered)
      const { data: beatsData } = await supabase
        .from('practice_beats')
        .select('is_mastered, mastered_at')
        .eq('speech_id', id);
      
      if (beatsData) {
        const today = new Date().toDateString();
        const allMastered = beatsData.every(b => b.is_mastered);
        const masteredToday = beatsData.some(b => {
          if (!b.mastered_at) return false;
          return new Date(b.mastered_at).toDateString() === today;
        });
        
        if (allMastered || masteredToday) {
          setTodaySessionDone(true);
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPractice = (bypassLock = false, bypassWarning = false, bypassSessionCheck = false) => {
    // For free users with session done, show premium upsell
    // For premium users, always allow practice
    if (!bypassSessionCheck && todaySessionDone && subscriptionTier === 'free') {
      setShowPremiumUpsell(true);
      return;
    }
    
    // Show spaced repetition info warning first (if not bypassing)
    if (!bypassWarning && !bypassLock) {
      setShowSpacedRepetitionInfo(true);
      return;
    }
    
    // Check if locked (skip this check if bypassing)
    if (!bypassLock && isLocked && nextReviewDate) {
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
    // For free users with session done, show premium upsell
    // For premium users, just start practice
    if (todaySessionDone && subscriptionTier === 'free') {
      setShowPremiumUpsell(true);
    } else {
      handleStartPractice(false, true, true);
    }
  };
  
  const handleSpacedRepetitionPracticeAnyway = () => {
    setShowSpacedRepetitionInfo(false);
    // Show premium upsell for free users, or start practice for premium
    if (subscriptionTier === 'free') {
      setShowPremiumUpsell(true);
    } else {
      handleStartPractice(true, true, true);
    }
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
      let speechLang = speech?.speech_language || 'en';
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
          
          // Helper: Check if words are similar enough - STRICT matching to prevent premature filling
          const areWordsSimilar = (spoken: string, expected: string): boolean => {
            // Exact match
            if (spoken === expected) return true;
            
            // For very short words (1-3 chars), require exact match
            if (expected.length <= 3) {
              return spoken === expected;
            }
            
            // For short words (4-5 chars), allow only 1 character difference
            if (expected.length <= 5) {
              return levenshtein(spoken, expected) <= 1;
            }
            
            // For longer words, require at least 80% character match
            // This prevents partial words from triggering a match
            const minLength = Math.min(spoken.length, expected.length);
            const maxLength = Math.max(spoken.length, expected.length);
            
            // Don't match if lengths are too different (spoken word is too short)
            if (minLength < maxLength * 0.7) return false;
            
            // Allow 1 char difference for 6-8 letter words, 2 for longer
            const maxDist = expected.length <= 8 ? 1 : 2;
            return levenshtein(spoken, expected) <= maxDist;
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
            
            // Check if spoken word matches expected word
            if (areWordsSimilar(cleanSpokenWord, cleanExpectedWord)) {
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
                setTimeout(() => { audioRecorderRef.current?.stopRecording(); }, 500);
              } else {
                startProgressiveHints(currentIdx, allExpectedWords, allExpectedWordsRaw);
              }
            } else {
              // Word doesn't match - look ahead to find match
              console.log('⚠️ Spoken word mismatch:', cleanSpokenWord, 'vs expected:', cleanExpectedWord);
              
              let matchFound = false;
              const maxLookAhead = 5;
              
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
            description: "AI is analyzing your practice session",
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
              originalText: activeSegmentText || speech!.text_original, // Analyze active segment or full speech
              speechId: speech!.id,
              userTier: subscriptionTier,
              language: speechLanguage,
              skillLevel: skillLevel,
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
          const originalWords = (activeSegmentOriginalText || speech!.text_original).split(/\s+/).filter((w: string) => w.trim());
          
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

  const handleSaveScript = async () => {
    if (!speech || !editedScriptText.trim()) return;
    
    try {
      // Update the speech text - keep text_current as-is to preserve bracket progress
      // Only update text_original (the source text)
      const { error } = await supabase
        .from('speeches')
        .update({ 
          text_original: editedScriptText.trim(),
          // Note: We intentionally do NOT reset text_current here
          // to preserve any bracket-based word hiding progress
        })
        .eq('id', speech.id);
      
      if (error) throw error;
      
      // Update existing segments' text WITHOUT resetting progress
      // Get current segments to preserve their mastery data
      const { data: existingSegments } = await supabase
        .from('speech_segments')
        .select('*')
        .eq('speech_id', speech.id)
        .order('segment_order', { ascending: true });
      
      if (existingSegments && existingSegments.length > 0) {
        // Update segment text but KEEP progress (is_mastered, times_practiced, etc.)
        const newWordCount = editedScriptText.trim().split(/\s+/).length;
        
        // If there's only one segment, update it preserving progress
        if (existingSegments.length === 1) {
          await supabase
            .from('speech_segments')
            .update({
              segment_text: editedScriptText.trim(),
              end_word_index: newWordCount - 1,
              // Preserve: is_mastered, times_practiced, average_accuracy, etc.
            })
            .eq('id', existingSegments[0].id);
        } else {
          // Multiple segments - update the first one with new text
          // This is a simplification; for complex multi-segment cases, 
          // we'd need smarter text diffing
          await supabase
            .from('speech_segments')
            .update({
              segment_text: editedScriptText.trim(),
              end_word_index: newWordCount - 1,
            })
            .eq('id', existingSegments[0].id);
        }
      } else {
        // No segments exist, create one (preserves old behavior for edge case)
        await supabase
          .from('speech_segments')
          .insert({
            speech_id: speech.id,
            segment_order: 0,
            segment_text: editedScriptText.trim(),
            start_word_index: 0,
            end_word_index: editedScriptText.trim().split(/\s+/).length - 1,
            is_mastered: false,
            times_practiced: 0
          });
      }
      
      toast({
        title: t('practice.scriptUpdated'),
        description: t('practice.scriptUpdatedDesc'),
      });
      
      setIsEditingScript(false);
      
      // Update local state immediately for practice
      setActiveSegmentText(editedScriptText.trim());
      loadSpeech(); // Reload to get fresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('practice.failedToSave'),
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!speech) return null;

  // Day-After Recall Mode
  if (isDayAfterRecall && !showResults) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Minimal header with exit */}
        <header className="flex items-center justify-between p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsDayAfterRecall(false);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.exit')}
          </Button>
          <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[50%]">
            {speech.title}
          </h1>
          <div className="w-16" />
        </header>
        
        <div className="flex-1 flex flex-col">
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
      <div className="min-h-screen bg-background flex flex-col">
        {/* Minimal header with exit */}
        <header className="flex items-center justify-between p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsPracticing(false);
              setIsRecording(false);
            }}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('common.exit')}
          </Button>
          <h1 className="text-sm font-medium text-muted-foreground truncate max-w-[50%]">
            {speech.title}
          </h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </header>
        
        {/* Full-height beat practice */}
        <div className="flex-1 flex flex-col">
          <BeatPracticeView
            speechId={speech.id}
            subscriptionTier={subscriptionTier}
            onComplete={() => {
              setIsPracticing(false);
              toast({
                title: t('beat_practice.beat_complete'),
                description: "All beats mastered!",
              });
            }}
            onExit={() => {
              setIsPracticing(false);
              setIsRecording(false);
            }}
            onSessionLimitReached={() => {
              // Free user hit daily beat limit - show premium upsell
              setIsPracticing(false);
              setShowPremiumUpsell(true);
            }}
          />
        </div>
      </div>
    );
  }

  // Old focus mode kept for reference - will be removed in future
  if (false && isPracticing && !showResults) {
    return (
      <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
        <LoadingOverlay isVisible={isProcessing} />
        
        {/* Header with exit button and progress indicator */}
        <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (isRecording) {
                  audioRecorderRef.current?.stopRecording();
                }
                setIsPracticing(false);
                setIsRecording(false);
              }}
              className="rounded-full hover:bg-card/80 backdrop-blur-sm shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
            
            {/* Progress indicator during recording */}
            {isRecording && (
              <div className="flex-1 max-w-md">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('practice.progress')}</span>
                  <span>
                    {expectedWordIndex} / {(activeSegmentText || speech.text_current || speech.text_original).split(/\s+/).filter(w => w.trim()).length} {t('practice.words')}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{ 
                      width: `${Math.min(100, (expectedWordIndex / Math.max(1, (activeSegmentText || speech.text_current || speech.text_original).split(/\s+/).filter(w => w.trim()).length)) * 100)}%` 
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Removed: Giant overlay popup - hints now appear inline in BracketedTextDisplay */}

        {/* Centered text content */}
        <div className="flex-1 flex items-center justify-center px-8 pb-32">
          <div className="max-w-4xl w-full">
            <BracketedTextDisplay
              text={cleanBracketNotation(activeSegmentText || speech.text_current || speech.text_original)}
              hiddenWordIndices={currentHiddenIndices}
              spokenWordsIndices={spokenWordsIndices}
              hesitatedWordsIndices={hesitatedWordsIndices}
              missedWordsIndices={missedWordsIndices}
              currentWordIndex={expectedWordIndex}
              isRecording={isRecording}
              hintingWordIndex={supportWordIndex ?? -1}
              hintLevel={hintLevel}
              onPeekWord={(index) => {
                setHesitatedWordsIndices(prev => {
                  const updated = new Set([...prev, index]);
                  hesitatedWordsIndicesRef.current = updated;
                  return updated;
                });
              }}
            />
          </div>
        </div>

        {/* Bottom recording button */}
        <div className="fixed bottom-8 left-0 right-0 flex justify-center">
          <Button
            size="lg"
            onClick={async () => {
              if (isRecording) {
                // Stop recording
                if (audioRecorderRef.current) {
                  audioRecorderRef.current.stopRecording();
                }
                // Stop speech recognition
                if (recognitionRef.current) {
                  recognitionRef.current.stop();
                }
              } else {
                // Start recording and speech recognition
                await handleRecordingStart();
                if (audioRecorderRef.current) {
                  await audioRecorderRef.current.startRecording();
                }
              }
            }}
            disabled={isProcessing}
            className="rounded-full px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-shadow"
          >
            {isRecording ? (
              <>
                <Square className="h-5 w-5 mr-2" />
                {t('practice.stopRecording')}
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                {t('practice.startRecording')}
              </>
            )}
          </Button>
        </div>

        {/* Hidden audio recorder */}
        <div className="hidden">
          <AudioRecorder
            ref={audioRecorderRef}
            isRecording={isRecording}
            onStart={handleRecordingStart}
            onStop={handleRecordingStop}
            disabled={isProcessing}
          />
        </div>
      </div>
    );
  }

  // Analysis screen: Clean, minimal results view
  if (showResults && sessionResults) {
    return (
      <div className="min-h-screen bg-background">
        <LoadingOverlay isVisible={isProcessing} />
        
        {/* Exit button */}
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="rounded-full hover:bg-card/80"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Centered analysis content */}
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('practice.results.title')}</h1>
            <p className="text-lg text-muted-foreground">{t('practice.results.feedback')}</p>
          </div>

          <div ref={resultsRef} className="animate-fade-in">
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
            <Card className="mt-8 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 animate-fade-in">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Target className="h-5 w-5" />
                    <span className="font-semibold text-lg">{t('practice.nextPractice')}</span>
                  </div>
                  
                  <div className="text-3xl font-bold">
                    {adaptiveScheduleResult.intervalMinutes < 60 
                      ? `${Math.round(adaptiveScheduleResult.intervalMinutes)} min`
                      : adaptiveScheduleResult.intervalMinutes < 24 * 60
                      ? `${(adaptiveScheduleResult.intervalMinutes / 60).toFixed(1)} hours`
                      : `${(adaptiveScheduleResult.intervalMinutes / (24 * 60)).toFixed(1)} days`}
                  </div>
                  
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {adaptiveScheduleResult.recommendation}
                  </p>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/50">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">{t('practice.weightedScore')}</span>
                      </div>
                      <span className="font-semibold">{Math.round(adaptiveScheduleResult.weightedAccuracy)}%</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">{t('practice.scriptVisible')}</span>
                      </div>
                      <span className="font-semibold">{Math.round(speech.base_word_visibility_percent || 100)}%</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">{t('practice.stage')}</span>
                      </div>
                      <span className="font-semibold capitalize">{adaptiveScheduleResult.learningStage}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          <div className="flex justify-center mt-8">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="rounded-full px-8"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('practice.results.dashboard')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Pre-practice screen: Beat-focused start screen
  const masteredBeats = segments.filter(s => s.is_mastered).length;
  const totalBeats = segments.length;
  const progressPercent = totalBeats > 0 ? (masteredBeats / totalBeats) * 100 : 0;
  const nextBeatNumber = masteredBeats + 1;
  const hasBeats = totalBeats > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <LoadingOverlay isVisible={isProcessing} />
      
      {/* Duolingo-style header with progress bar */}
      <header className="sticky top-0 z-10 bg-background border-b border-border/30">
        <div className="container mx-auto px-4 py-3">
          {/* Close button and progress */}
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="shrink-0 rounded-full hover:bg-muted"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
            
            {/* Progress bar */}
            <div className="flex-1">
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {subscriptionTier !== 'free' && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenEditScript}
                  className="rounded-full"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/presentation/${id}`)}
                className="rounded-full"
              >
                <Presentation className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - centered and focused */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 pb-32">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mascot / Icon area */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Brain className="h-12 w-12 text-primary" />
              </div>
              {/* Sparkle decoration */}
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-amber-400 animate-pulse" />
            </div>
            
            {/* Title */}
            {speech && (
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">{speech.title}</h1>
                {speech.goal_date && (
                  <p className="text-sm text-muted-foreground">
                    {t('practice.goal')}: {format(new Date(speech.goal_date), "PPP")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Progress stats - Duolingo style circles */}
          <div className="flex justify-center gap-6">
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${progressPercent * 2.64} 264`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold">{masteredBeats}</span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground mt-1">{t('beat_practice.mastered', 'Mastered')}</span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <span className="text-lg font-bold text-muted-foreground">{totalBeats - masteredBeats}</span>
              </div>
              <span className="text-xs text-muted-foreground mt-1">{t('beat_practice.remaining', 'Remaining')}</span>
            </div>
          </div>

          {/* Session Card - Clean and simple */}
          <div className="bg-card rounded-3xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">
                  {masteredBeats === 0 
                    ? t('beat_practice.todays_session', "Today's Session")
                    : t('beat_practice.active_session', 'Active Session')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {masteredBeats > 0 
                    ? t('beat_practice.session_desc_recall', 'Recall + learn new beats')
                    : t('beat_practice.session_desc_start', 'Start with your first beat')}
                </p>
              </div>
            </div>
            
            {/* Beat pills */}
            <div className="flex flex-wrap gap-2">
              {masteredBeats > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                  <RotateCcw className="h-3.5 w-3.5" />
                  {masteredBeats} to recall
                </span>
              )}
              {nextBeatNumber <= totalBeats && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  <Zap className="h-3.5 w-3.5" />
                  Beat {nextBeatNumber} to learn
                </span>
              )}
            </div>
          </div>

          {/* Beat Timeline - Compact horizontal dots */}
          {hasBeats && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">{t('beat_practice.your_progress', 'Your Progress')}</p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {segments.map((segment, idx) => (
                  <div
                    key={segment.id}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                      ${segment.is_mastered 
                        ? 'bg-primary text-primary-foreground' 
                        : idx === masteredBeats 
                          ? 'bg-primary/20 text-primary border-2 border-primary ring-2 ring-primary/20' 
                          : 'bg-muted text-muted-foreground'}
                    `}
                  >
                    {segment.is_mastered ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Day-After Recall - Subtle option */}
          {masteredBeats > 0 && (
            <button
              onClick={() => setIsDayAfterRecall(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all group"
            >
              <div className="flex items-center gap-3">
                <Sunrise className="h-5 w-5 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium text-blue-600 dark:text-blue-400">
                    {t('day_after_recall.title', '🌅 Day-After Recall')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('day_after_recall.card_desc', 'No script, memory test only')}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-blue-500 group-hover:translate-x-1 transition-transform" />
            </button>
          )}

          {/* Lock info */}
          {isLocked && nextReviewDate && (
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">
                    {t('practice.aiRecommendsWaiting')}
                    <span className="font-semibold">
                      <LockCountdown nextReviewDate={nextReviewDate} />
                    </span>
                  </p>
                  {subscriptionTier === 'free' && (
                    <Button 
                      variant="link" 
                      size="sm"
                      onClick={() => navigate("/settings")}
                      className="text-amber-600 p-0 h-auto mt-1"
                    >
                      <Crown className="h-3.5 w-3.5 mr-1" />
                      {t('practice.upgradeToPremium')}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Premium Practice Anyway button */}
              {subscriptionTier !== 'free' && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTimingWarning(true)}
                  className="w-full border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                >
                  <Crown className="h-3.5 w-3.5 mr-1.5" />
                  {t('practice.practiceAnyway')}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Fixed bottom CTA - Duolingo style */}
      <div className="fixed bottom-0 left-0 right-0 p-4 pb-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-md mx-auto">
          <Button 
            size="lg" 
            onClick={() => handleStartPractice()}
            disabled={isLocked}
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
          >
            <Play className="h-5 w-5 mr-2" />
            {isLocked 
              ? t('practice.locked') 
              : t('beat_practice.start_session', 'Start Session')}
          </Button>
        </div>
      </div>

      {/* Premium User Timing Warning Dialog */}
      <AlertDialog open={showTimingWarning} onOpenChange={setShowTimingWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('practice.practicingEarly')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  {t('practice.aiRecommendsWaiting')}<strong><LockCountdown nextReviewDate={nextReviewDate!} /></strong>
                </p>
                <p className="text-muted-foreground">
                  {t('practice.spacedRepetitionEffective')}
                </p>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mt-4">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t('practice.editScriptTitle')}</DialogTitle>
            <DialogDescription>
              {t('practice.editScriptDesc')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editedScriptText}
            onChange={(e) => setEditedScriptText(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder={t('practice.enterSpeechText')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingScript(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveScript}>
              {t('practice.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spaced Repetition Info Dialog */}
      <AlertDialog open={showSpacedRepetitionInfo} onOpenChange={setShowSpacedRepetitionInfo}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              {t('practice.spacedRepetitionTitle', 'Spaced Repetition Learning')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-foreground">
                  {t('practice.spacedRepetitionExplain', 'This app uses spaced repetition - a scientifically proven method that optimizes your memory retention.')}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {t('practice.spacedBenefit1', 'Reviews are scheduled at optimal intervals for long-term memory')}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {t('practice.spacedBenefit2', 'Practicing too early can reduce retention effectiveness')}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {t('practice.spacedBenefit3', 'Trust the AI scheduling for best results')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t('practice.spacedWarning', 'Recalling too early disrupts the memory consolidation process and may weaken long-term retention.')}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleSpacedRepetitionPracticeAnyway} className="border-muted-foreground/20">
              {t('practice.practiceAnyway', 'Practice Anyway')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSpacedRepetitionContinue}>
              {t('practice.iUnderstandContinue', 'I Understand, Continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Premium Upsell Dialog (compact) */}
      <Dialog open={showPremiumUpsell} onOpenChange={setShowPremiumUpsell}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <Crown className="h-5 w-5 text-amber-500" />
              {t('practice.unlockFlexibility', 'Unlock Flexibility')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground text-center">
              {t('practice.premiumBypassDesc', 'Premium members can bypass spaced repetition timing when needed.')}
            </p>
            
            <div className="space-y-2 bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.premiumFeature1', 'Practice anytime you want')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.premiumFeature2', 'AI-optimized scheduling')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.premiumFeature3', 'Unlimited speeches')}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2">
            <Button 
              onClick={() => {
                setShowPremiumUpsell(false);
                navigate("/settings");
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              {t('nav.upgradeToPremium', 'Upgrade to Premium')}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowPremiumUpsell(false)}
              className="w-full text-muted-foreground"
            >
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Complete Dialog */}
      <Dialog open={showSessionComplete} onOpenChange={setShowSessionComplete}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
            </div>
            
            <DialogHeader className="text-center">
              <DialogTitle className="text-center">
                {t('practice.sessionCompleteTitle', "Today's Session Complete!")}
              </DialogTitle>
            </DialogHeader>
            
            <p className="text-sm text-muted-foreground">
              {t('practice.sessionCompleteDesc', "Great work! Your brain needs time to consolidate what you've learned. Come back later for better retention.")}
            </p>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <Brain className="h-4 w-4 text-primary" />
              <span>{t('practice.restHelpsMemory', 'Rest helps memory consolidation')}</span>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2">
            <Button 
              onClick={() => {
                setShowSessionComplete(false);
                navigate("/dashboard");
              }}
              className="w-full"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t('common.done', 'Done')}
            </Button>
            <Button 
              variant="ghost"
              onClick={() => {
                setShowSessionComplete(false);
                // Small delay to allow dialog to close before showing next one
                setTimeout(() => {
                  if (subscriptionTier === 'free') {
                    setShowPremiumUpsell(true);
                  } else {
                    handleStartPractice(true, true, true);
                  }
                }, 150);
              }}
              className="w-full text-muted-foreground"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('practice.practiceAnyway', 'Practice Anyway')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Practice;
