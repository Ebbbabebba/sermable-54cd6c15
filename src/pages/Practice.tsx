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
import { ArrowLeft, Play, RotateCcw, Presentation, X, Square, Eye, Target, Pencil, Clock, Lock, Crown, AlertTriangle } from "lucide-react";
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
import { format } from "date-fns";
import AudioRecorder, { AudioRecorderHandle } from "@/components/AudioRecorder";
import WordHighlighter from "@/components/WordHighlighter";
import PracticeResults from "@/components/PracticeResults";
import EnhancedWordTracker from "@/components/EnhancedWordTracker";
import BracketedTextDisplay from "@/components/BracketedTextDisplay";
import PracticeSettings, { PracticeSettingsConfig } from "@/components/PracticeSettings";
import LoadingOverlay from "@/components/LoadingOverlay";
import LockCountdown from "@/components/LockCountdown";

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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [activeSegmentIndices, setActiveSegmentIndices] = useState<number[]>([]);
  const [activeSegmentText, setActiveSegmentText] = useState<string>("");
  const [activeSegmentOriginalText, setActiveSegmentOriginalText] = useState<string>(""); // Original text for active segment (for analysis)
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
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
  const [settings, setSettings] = useState<PracticeSettingsConfig>({
    revealSpeed: 5,
    showWordOnPause: true,
    animationStyle: 'playful',
    keywordMode: false,
    hesitationThreshold: 5,
    firstWordHesitationThreshold: 6,
    sentenceStartDelay: 5, // 5 seconds extra delay for first word of new sentence
  });
  const [averageWordDelay, setAverageWordDelay] = useState<number>(800); // Track user's average pace - start faster
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

    // Find the first unmastered segment
    const firstUnmasteredIndex = allSegments.findIndex((s) => !s.is_mastered);

    if (firstUnmasteredIndex === -1) {
      // All segments mastered - practice the whole speech
      setActiveSegmentIndices(allSegments.map((s) => s.segment_order));
      setActiveSegmentText(currentSpeech?.text_current || currentSpeech?.text_original || "");
      setActiveSegmentOriginalText(currentSpeech?.text_original || "");
      return;
    }

    // Check if we should merge with previous segment
    if (firstUnmasteredIndex > 0) {
      const previousSegment = allSegments[firstUnmasteredIndex - 1];

      // If previous segment is mastered, practice both together
      if (previousSegment.is_mastered) {
        const currentSegment = allSegments[firstUnmasteredIndex];
        const activeSegs = [previousSegment, currentSegment];

        setActiveSegmentIndices([previousSegment.segment_order, currentSegment.segment_order]);
        setActiveSegmentText(getCurrentTextForSegments(activeSegs));
        setActiveSegmentOriginalText(getOriginalTextForSegments(activeSegs));
        return;
      }
    }

    // Practice only the current unmastered segment
    const currentSegment = allSegments[firstUnmasteredIndex];
    setActiveSegmentIndices([currentSegment.segment_order]);
    setActiveSegmentText(getCurrentTextForSegments([currentSegment]));
    setActiveSegmentOriginalText(getOriginalTextForSegments([currentSegment]));
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

  const handleStartPractice = () => {
    // Check if locked
    if (isLocked && nextReviewDate) {
      toast({
        title: t('practice.practiceScheduled'),
        description: t('practice.aiRecommendsAt', { time: format(nextReviewDate, "'at' HH:mm") }),
        duration: 3000,
      });
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
    setAverageWordDelay(800); // Start with faster default pace
    
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
    
    // Adaptive timing based on user's speaking pace
    // Give user MORE time to think before showing hints
    // First word gets extra time, subsequent words adapt to pace
    const isFirstWord = wordIndex === 0;
    
    // Check if current word is the first word after a sentence-ending punctuation
    // IMPORTANT: use the RAW words (with punctuation) for sentence detection
    const isFirstWordAfterSentence = wordIndex > 0 && (() => {
      const prevWordRaw = expectedWordsRaw[wordIndex - 1] ?? '';
      return /[.!?][)"'’”]*$/.test(prevWordRaw);
    })();
    
    // Base delays
    let minDelay = isFirstWord ? 3500 : 2000; // 3.5s for first word, 2s for rest
    let maxDelay = isFirstWord ? 5000 : 3500; // Cap at 5s/3.5s
    
    // Add extra delay for first word after a sentence (from settings)
    if (isFirstWordAfterSentence) {
      const sentenceStartDelayMs = settings.sentenceStartDelay * 1000;
      minDelay += sentenceStartDelayMs;
      maxDelay += sentenceStartDelayMs;
      console.log('🔤 First word after sentence - adding', settings.sentenceStartDelay, 's extra delay');
    }
    
    const paceMultiplier = 2.2; // Give 2.2x their average pace before hint
    
    const adaptiveDelay = Math.min(maxDelay, Math.max(minDelay, averageWordDelay * paceMultiplier));
    const stepDelay = Math.min(1200, Math.max(600, averageWordDelay * 0.9)); // Longer steps between hint levels
    
    // Level 1: First letter hint (adaptive to user pace)
    hesitationTimerRef.current = setTimeout(() => {
      setSupportWord(wordToShow);
      setSupportWordIndex(wordIndex);
      setHintLevel(1);
      console.log('💡 Hint level 1 (first letter):', wordToShow.slice(0, 1) + '___', 'delay:', adaptiveDelay);
      
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
    }, adaptiveDelay);
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
          
          // Helper: Check if words are similar enough - MORE GENEROUS to avoid false skips
          const areWordsSimilar = (spoken: string, expected: string): boolean => {
            // Exact match
            if (spoken === expected) return true;
            
            // Check if one contains the other (handles partial recognition)
            if (spoken.includes(expected) || expected.includes(spoken)) return true;
            
            // Check if they start the same (first 3+ chars) - handles truncated recognition
            if (spoken.length >= 3 && expected.length >= 3) {
              const prefix = Math.min(3, Math.min(spoken.length, expected.length));
              if (spoken.slice(0, prefix) === expected.slice(0, prefix)) {
                // Starting same, check overall similarity
                const dist = levenshtein(spoken, expected);
                const maxLen = Math.max(spoken.length, expected.length);
                // Allow up to 40% difference if starting same
                if (dist <= maxLen * 0.4) return true;
              }
            }
            
            // For very short words (1-3 chars), require exact match
            if (expected.length <= 3) {
              return spoken === expected;
            }
            
            // For short words (4-5 chars), allow 1-2 character difference
            if (expected.length <= 5) {
              return levenshtein(spoken, expected) <= 2;
            }
            
            // For longer words, be more generous
            const minLength = Math.min(spoken.length, expected.length);
            const maxLength = Math.max(spoken.length, expected.length);
            
            // Allow if lengths are somewhat similar (60% min)
            if (minLength < maxLength * 0.6) return false;
            
            // Calculate distance and allow based on word length
            const dist = levenshtein(spoken, expected);
            // Allow up to 30% difference for longer words
            return dist <= Math.ceil(expected.length * 0.3);
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
              
              // HESITATION DETECTION: Mark as hesitated if user took too long
              // Use adaptive threshold based on their pace, but with minimums
              // Add extra time for first word after sentences
              const isFirstWordInSession = currentIdx === 0;
              const sentenceStartExtraMs = isFirstWordAfterSentence ? settings.sentenceStartDelay * 1000 : 0;
              const hesitationThresholdMs = isFirstWordInSession 
                ? Math.max(3000, averageWordDelay * 2.5) // First word: 3s minimum
                : Math.max(1500, averageWordDelay * 2.0) + sentenceStartExtraMs; // Other words + sentence delay
              
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
              
              // Update timing tracking
              lastWordTimeRef.current = currentTime;
              
              if (currentIdx > 1 && timeSinceLastWord < 8000) {
                // EWMA: Weight recent words more heavily for faster adaptation
                const weight = wordTimingsRef.current.length < 3 ? 0.7 : 0.4;
                const newAvg = wordTimingsRef.current.length === 0 
                  ? timeSinceLastWord 
                  : averageWordDelay * (1 - weight) + timeSinceLastWord * weight;
                setAverageWordDelay(Math.min(2000, Math.max(200, newAvg)));
                wordTimingsRef.current.push(timeSinceLastWord);
                if (wordTimingsRef.current.length > 8) wordTimingsRef.current.shift();
                console.log('📊 Speaking pace:', Math.round(timeSinceLastWord), 'ms, Avg:', Math.round(newAvg), 'ms');
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
                      // Skipped words - ALL skipped words are missed (red)
                      // User jumped ahead and skipped words they should have said
                      queueWordAction('missed', i, allExpectedWords[i]);
                      console.log('❌ Skipped word (red):', allExpectedWords[i], 'at index', i);
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
                  // If user saw support word but said wrong word, mark as hesitated (yellow) not missed (red)
                  // because they hesitated and needed help, even if they then said wrong word
                  if (currentHiddenIndices.has(previousSupportWordIndex)) {
                    // Check if already marked as hesitated - keep it yellow, don't change to red
                    if (!hesitatedWordsIndices.has(previousSupportWordIndex)) {
                      queueWordAction('hesitated', previousSupportWordIndex, allExpectedWords[previousSupportWordIndex]);
                      console.log('⚠️ Hidden support word - marking as hesitated (yellow):', allExpectedWords[previousSupportWordIndex]);
                    } else {
                      console.log('⚠️ Hidden support word already hesitated (yellow):', allExpectedWords[previousSupportWordIndex]);
                    }
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
          if (activeSegmentIndices.length > 0) {
            for (const segmentOrder of activeSegmentIndices) {
              const segment = segments.find(s => s.segment_order === segmentOrder);
              if (segment) {
                const newTimesPracticed = segment.times_practiced + 1;
                const oldAvg = segment.average_accuracy || 0;
                const newAvg = oldAvg === 0 
                  ? data.accuracy 
                  : (oldAvg * segment.times_practiced + data.accuracy) / newTimesPracticed;
                
                // Mark as mastered if accuracy >= 85% and practiced at least twice
                const isMastered = newAvg >= 85 && newTimesPracticed >= 2;

                await supabase
                  .from('speech_segments')
                  .update({
                    times_practiced: newTimesPracticed,
                    average_accuracy: newAvg,
                    last_practiced_at: new Date().toISOString(),
                    is_mastered: isMastered,
                  })
                  .eq('id', segment.id);

                console.log(`📊 Segment ${segmentOrder} updated: ${newTimesPracticed}x practiced, ${Math.round(newAvg)}% avg, mastered: ${isMastered}`);
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

              // Check if we should merge segments
              const shouldMerge = activeSegmentIndices.length === 2 &&
                updatedSegments.filter(s => activeSegmentIndices.includes(s.segment_order))
                  .every(s => s.is_mastered);

              if (shouldMerge) {
                toast({
                  title: `🎉 ${t('practice.segmentsMerged')}`,
                  description: t('practice.segmentsMergedDesc'),
                  duration: 5000,
                });
              }
            }
          }

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

          try {
            const { error: masteryError } = await supabase.functions.invoke('update-segment-word-mastery', {
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
            }
          } catch (err) {
            console.error('Failed to update segment word mastery:', err);
          }

          // AUTOMATIC SCHEDULING: Call adaptive learning - no manual rating needed
          try {
            const { data: { session: authSession } } = await supabase.auth.getSession();
            if (authSession) {
              const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('update-adaptive-learning', {
                body: {
                  speechId: speech!.id,
                  sessionAccuracy: data.accuracy,
                  wordVisibilityPercent: speech!.base_word_visibility_percent || 100
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
      // Update the speech text
      const { error } = await supabase
        .from('speeches')
        .update({ 
          text_original: editedScriptText.trim(),
          text_current: editedScriptText.trim()
        })
        .eq('id', speech.id);
      
      if (error) throw error;
      
      // Delete existing segments so they get regenerated with new text
      await supabase
        .from('speech_segments')
        .delete()
        .eq('speech_id', speech.id);
      
      // Create a single new segment with the updated text
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

  // Focus Mode: Full-screen minimal practice view
  if (isPracticing && !showResults) {
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

  // Pre-practice screen: Start screen with lock/unlock
  return (
    <div className="min-h-screen bg-background">
      <LoadingOverlay isVisible={isProcessing} />
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('common.back')}
              </Button>
              {speech && (
                <>
                  <div className="border-l pl-4 hidden md:block">
                    <h1 className="text-lg font-semibold capitalize">{speech.title}</h1>
                    {speech.goal_date && (
                      <p className="text-sm text-muted-foreground">
                        {t('practice.goal')}: {format(new Date(speech.goal_date), "PPP")}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenEditScript}
              >
                <Pencil className="h-4 w-4 mr-2" />
                {t('practice.editScript')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/presentation/${id}`)}
              >
                <Presentation className="h-4 w-4 mr-2" />
                {t('practice.presentationMode')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Active Segment Info */}
          {segments.length > 1 && activeSegmentIndices.length > 0 && (
            <Card className="border-primary bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary rounded-lg">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {activeSegmentIndices.length === 1 
                        ? t('practice.learningSegmentOf', { num: activeSegmentIndices[0] + 1, total: segments.length })
                        : t('practice.mergingSegments', { num1: activeSegmentIndices[0] + 1, num2: activeSegmentIndices[1] + 1 })}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activeSegmentIndices.length === 1
                        ? t('practice.practicingWords', { count: Math.ceil(activeSegmentText.split(/\s+/).length) })
                        : t('practice.combiningWords', { count: Math.ceil(activeSegmentText.split(/\s+/).length) })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Single segment or full speech info */}
          {segments.length <= 1 && (
            <Card className="border-cosmic-teal/20 bg-gradient-to-r from-cosmic-teal/5 to-cosmic-teal/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cosmic-teal rounded-lg">
                    <span className="text-2xl">📝</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{t('practice.practiceFullSpeech')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('practice.wordsTotal', { count: speech.text_original.split(/\s+/).length })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{t('practice.yourProgress')}</CardTitle>
              <CardDescription>{t('practice.trackMemorization')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('practice.wordsMemorized')}</span>
                  <span className="font-medium">{(() => {
                  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                  const wordsMemorized = Math.max(0, originalWords - currentWords);
                  return originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                })()}%</span>
                </div>
                <Progress value={(() => {
                  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
                  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
                  const wordsMemorized = Math.max(0, originalWords - currentWords);
                  return originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
                })()} />
              </div>
            </CardContent>
          </Card>

          {/* Segment Progress */}
          {segments.length > 0 && (
            <SegmentProgress 
              segments={segments} 
              activeSegmentIndices={activeSegmentIndices} 
            />
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12 space-y-4">
                {isLocked && nextReviewDate && (
                  <>
                    {subscriptionTier === 'free' ? (
                      // Free users: Hard lock
                      <div className="mb-4 p-6 bg-gradient-to-r from-destructive/10 to-destructive/5 rounded-lg border border-destructive/20">
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <Lock className="h-6 w-6 text-destructive" />
                          <p className="font-semibold text-lg">{t('practice.practiceLocked')}</p>
                        </div>
                        <p className="text-2xl font-bold text-destructive mb-2">
                          <LockCountdown nextReviewDate={nextReviewDate} />
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t('practice.spacedRepetitionInfo')}
                          <br />
                          {t('practice.practicingTooEarly')}
                        </p>
                        <div className="pt-4 border-t border-border/50">
                          <p className="text-sm text-muted-foreground mb-3">
                            <Crown className="h-4 w-4 inline mr-1 text-amber-500" />
                            {t('practice.premiumCanPractice')}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate("/settings")}
                            className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            {t('practice.upgradeToPremium')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Premium users: Soft warning
                      <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Clock className="h-5 w-5 text-primary" />
                          <p className="font-medium">
                            {t('practice.aiRecommendedTime')}
                          </p>
                        </div>
                        <p className="text-lg font-semibold text-primary">
                          <LockCountdown nextReviewDate={nextReviewDate} />
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {t('practice.optimalSpacing')}
                        </p>
                      </div>
                    )}
                  </>
                )}
                <Button 
                  size="lg" 
                  onClick={() => {
                    if (isLocked && subscriptionTier !== 'free') {
                      setShowTimingWarning(true);
                    } else if (!isLocked || subscriptionTier === 'free') {
                      if (!isLocked) handleStartPractice();
                    }
                  }}
                  disabled={isLocked && subscriptionTier === 'free'}
                  className="rounded-full px-8"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {isLocked ? (subscriptionTier === 'free' ? t('practice.locked') : t('practice.practiceAnyway')) : t('practice.startPractice')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Premium User Timing Warning Dialog */}
      <AlertDialog open={showTimingWarning} onOpenChange={setShowTimingWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t('practice.practicingEarly')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('practice.aiRecommendsWaiting', { time: '' })}<strong><LockCountdown nextReviewDate={nextReviewDate!} /></strong>
              </p>
              <p className="text-muted-foreground">
                {t('practice.spacedRepetitionEffective')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('practice.waitForOptimal')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartPractice}>
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
    </div>
  );
};

export default Practice;
