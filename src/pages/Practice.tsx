import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw, Presentation, X, Square, Eye, Target, Pencil, Clock } from "lucide-react";
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
}

const Practice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [settings, setSettings] = useState<PracticeSettingsConfig>({
    revealSpeed: 5,
    showWordOnPause: true,
    animationStyle: 'playful',
    keywordMode: false,
    hesitationThreshold: 5,
    firstWordHesitationThreshold: 6,
  });
  const [averageWordDelay, setAverageWordDelay] = useState<number>(2000); // Track user's average pace
  const wordTimingsRef = useRef<number[]>([]); // Store recent word timing intervals
  const [liveTranscription, setLiveTranscription] = useState("");
  const [spokenWordsIndices, setSpokenWordsIndices] = useState<Set<number>>(new Set());
  const [hesitatedWordsIndices, setHesitatedWordsIndices] = useState<Set<number>>(new Set());
  const [missedWordsIndices, setMissedWordsIndices] = useState<Set<number>>(new Set());
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
    
    if (allSegments.length === 0) {
      setActiveSegmentIndices([]);
      setActiveSegmentText("");
      setActiveSegmentOriginalText("");
      return;
    }

    // Helper to extract original text from speech using segment word indices
    const getOriginalTextForSegments = (segs: Segment[]): string => {
      if (!currentSpeech?.text_original) return "";
      const originalWords = currentSpeech.text_original.split(/\s+/);
      const startIdx = Math.min(...segs.map(s => s.start_word_index));
      const endIdx = Math.max(...segs.map(s => s.end_word_index));
      return originalWords.slice(startIdx, endIdx + 1).join(' ');
    };

    // Find the first unmastered segment
    const firstUnmasteredIndex = allSegments.findIndex(s => !s.is_mastered);
    
    if (firstUnmasteredIndex === -1) {
      // All segments mastered - practice the whole speech
      setActiveSegmentIndices(allSegments.map(s => s.segment_order));
      setActiveSegmentText(allSegments.map(s => s.segment_text).join(' '));
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
        setActiveSegmentText(`${previousSegment.segment_text} ${currentSegment.segment_text}`);
        setActiveSegmentOriginalText(getOriginalTextForSegments(activeSegs));
        return;
      }
    }

    // Practice only the current unmastered segment
    const currentSegment = allSegments[firstUnmasteredIndex];
    setActiveSegmentIndices([currentSegment.segment_order]);
    setActiveSegmentText(currentSegment.segment_text);
    setActiveSegmentOriginalText(getOriginalTextForSegments([currentSegment]));
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
        title: "Error loading speech",
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
        title: "Practice Scheduled",
        description: `The AI recommends practicing again ${nextReviewDate ? format(nextReviewDate, "'at' HH:mm") : 'soon'}. Starting anyway...`,
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
        ? `Learning Segment ${activeSegmentIndices[0] + 1}`
        : `Practicing Segments ${activeSegmentIndices[0] + 1} & ${activeSegmentIndices[1] + 1} together`;
      
      toast({
        title: "Practice mode activated",
        description: `${segmentInfo}. Read aloud when ready, then start recording.`,
        duration: 5000,
      });
    } else {
      toast({
        title: "Practice mode activated",
        description: "Read your speech aloud when ready, then start recording.",
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
    setLastProcessedTranscriptLength(0);
    setSupportWord(null);
    setSupportWordIndex(null);
    setHintLevel(0);
    lastWordTimeRef.current = Date.now();
    wordTimingsRef.current = []; // Reset pace tracking
    setAverageWordDelay(2000); // Reset to default pace
    
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
  const startProgressiveHints = (wordIndex: number, expectedWords: string[]) => {
    // Clear existing hint timers
    if (hesitationTimerRef.current) clearTimeout(hesitationTimerRef.current);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    setHintLevel(0);
    setSupportWord(null);
    setSupportWordIndex(null);
    
    const wordToShow = expectedWords[wordIndex];
    
    // Adaptive timing based on user's speaking pace
    // Fast speakers (< 400ms avg): shorter delays (500ms min)
    // Slow speakers (> 1500ms avg): longer delays (1500ms)
    // Normal speakers: scale proportionally
    const minDelay = 400; // Allow very fast speakers
    const maxDelay = 2000; // Cap for slow speakers
    const paceMultiplier = 1.5; // Give 1.5x their average pace before hint
    
    const adaptiveDelay = Math.min(maxDelay, Math.max(minDelay, averageWordDelay * paceMultiplier));
    const stepDelay = Math.min(1000, Math.max(400, averageWordDelay * 0.8)); // Steps scale with pace
    
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
        
        // Level 3: Full word (after another step) - mark as hesitated ONLY if hidden
        hintTimerRef.current = setTimeout(() => {
          setHintLevel(3);
          // Only mark as hesitated (yellow) if the word is hidden
          if (currentHiddenIndices.has(wordIndex)) {
            setHesitatedWordsIndices(prev => new Set([...prev, wordIndex]));
            console.log('💡 Hint level 3 (full word - marked yellow, hidden word):', wordToShow);
          } else {
            console.log('💡 Hint level 3 (full word shown, visible word - no yellow):', wordToShow);
          }
          
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
      // Use speech's stored language first, then detect from text as fallback
      let speechLang = speech?.speech_language || 'en';
      
      // If speech language is not set or is default, try to detect from text
      if (!speech?.speech_language || speech.speech_language === 'en') {
        const { detectTextLanguage } = await import('@/utils/languageDetection');
        const detectedLang = detectTextLanguage(speech!.text_current);
        if (detectedLang) {
          speechLang = detectedLang;
        }
      }
      
      console.log('🌍 Using language for speech recognition:', speechLang);
      
      // Start Web Speech API for instant transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 3;
        recognition.lang = getRecognitionLocale(speechLang);
        
        console.log('📝 Recognition configured with locale:', recognition.lang);
        
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
          
          // Get expected words from the active segment or full speech
          // Use regex that preserves Nordic/accented characters (äöüåéèñ etc)
          const allExpectedWords = (activeSegmentText || speech!.text_original).toLowerCase().split(/\s+/).map(w => w.replace(/[^\p{L}\p{N}]/gu, ''));
          
          // Only process NEW words from the transcript (not already processed)
          setLastProcessedTranscriptLength(prevLength => {
            const newWords = transcriptWords.slice(prevLength);
            
            if (newWords.length === 0) {
              return prevLength; // No new words
            }
            
            console.log('🆕 New words detected:', newWords, 'Previous length:', prevLength);
            
            // Process new words sequentially
            setExpectedWordIndex(currentIndex => {
              let newIndex = currentIndex;
              
              for (const word of newWords) {
                // Preserve Nordic/accented characters when cleaning
                const cleanSpokenWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
                
                if (cleanSpokenWord && newIndex < allExpectedWords.length) {
                  // Hide support word immediately when ANY word is spoken
                  const wasSupportWordShowing = supportWord !== null;
                  const previousSupportWordIndex = supportWordIndex;
                  setSupportWord(null);
                  setSupportWordIndex(null);
                  
                  const expectedWord = allExpectedWords[newIndex];
                  const cleanExpectedWord = expectedWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
                  
                  console.log('🔍 Comparing:', cleanSpokenWord, 'vs', cleanExpectedWord, 'at index', newIndex);
                  
                  // Check if the spoken word matches the expected word (more flexible matching)
                  const isExactMatch = cleanSpokenWord === cleanExpectedWord;
                  const isPartialMatch = cleanSpokenWord.includes(cleanExpectedWord) || 
                                        cleanExpectedWord.includes(cleanSpokenWord);
                  const isSimilar = cleanSpokenWord.length > 2 && cleanExpectedWord.length > 2 &&
                                   (cleanSpokenWord.startsWith(cleanExpectedWord.slice(0, 3)) ||
                                    cleanExpectedWord.startsWith(cleanSpokenWord.slice(0, 3)));
                  
                  if (isExactMatch || isPartialMatch || isSimilar) {
                    // Check if this word was shown as support word
                    if (wasSupportWordShowing && previousSupportWordIndex === newIndex) {
                      // User said it correctly after support word - mark yellow ONLY if hidden
                      if (currentHiddenIndices.has(newIndex)) {
                        setHesitatedWordsIndices(prev => new Set([...prev, newIndex]));
                        console.log('✓ Hidden support word spoken correctly (yellow):', expectedWord, 'at index', newIndex);
                      } else {
                        setSpokenWordsIndices(prev => new Set([...prev, newIndex]));
                        console.log('✓ Visible support word spoken correctly (gray):', expectedWord, 'at index', newIndex);
                      }
                    } else {
                      // Normal correct word - mark as spoken
                      setSpokenWordsIndices(prev => new Set([...prev, newIndex]));
                      // Remove from missed/hesitated if it was marked before
                      setMissedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(newIndex);
                        return updated;
                      });
                      setHesitatedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(newIndex);
                        return updated;
                      });
                      console.log('✓ Word spoken correctly:', expectedWord, 'at index', newIndex);
                    }
                    
                    // Clear any hesitation/hint timers
                    clearHints();
                    
                    // Move to next expected word
                    newIndex++;
                    const currentTime = Date.now();
                    const timeSinceLastWord = currentTime - lastWordTimeRef.current;
                    lastWordTimeRef.current = currentTime;
                    
                    // Track word timing for adaptive pace (ignore very first word)
                    if (newIndex > 1 && timeSinceLastWord < 10000) { // Ignore pauses > 10s
                      wordTimingsRef.current.push(timeSinceLastWord);
                      // Keep only last 10 timings for rolling average
                      if (wordTimingsRef.current.length > 10) {
                        wordTimingsRef.current.shift();
                      }
                      // Calculate average pace
                      const avgPace = wordTimingsRef.current.reduce((a, b) => a + b, 0) / wordTimingsRef.current.length;
                      setAverageWordDelay(avgPace);
                      console.log('📊 Average speaking pace:', Math.round(avgPace), 'ms per word');
                    }
                    
                    // Check if we've reached the last word - automatically stop recording
                    if (newIndex >= allExpectedWords.length) {
                      console.log('🎉 Last word spoken! Auto-stopping recording...');
                      // Stop recording automatically
                      setTimeout(() => {
                        if (audioRecorderRef.current) {
                          audioRecorderRef.current.stopRecording();
                        }
                      }, 500); // Small delay to ensure last word is fully processed
                    } else {
                      // Start progressive hints for next word
                      startProgressiveHints(newIndex, allExpectedWords);
                    }
                  } else {
                    // Word doesn't match
                    console.log('⚠️ Spoken word mismatch:', cleanSpokenWord, 'vs expected:', cleanExpectedWord);
                    
                    // If support word was showing, mark it as missed (red) ONLY if hidden
                    if (wasSupportWordShowing && previousSupportWordIndex !== null) {
                      // Remove from hesitated (yellow) and mark as red (missed) ONLY if hidden
                      setHesitatedWordsIndices(prev => {
                        const updated = new Set(prev);
                        updated.delete(previousSupportWordIndex);
                        return updated;
                      });
                      if (currentHiddenIndices.has(previousSupportWordIndex)) {
                        setMissedWordsIndices(prev => new Set([...prev, previousSupportWordIndex]));
                        console.log('❌ Hidden support word not spoken correctly (red):', allExpectedWords[previousSupportWordIndex], 'at index', previousSupportWordIndex);
                      } else {
                        console.log('⏭️ Visible support word skipped (no red):', allExpectedWords[previousSupportWordIndex], 'at index', previousSupportWordIndex);
                      }
                      
                      // Try to find the spoken word ahead
                      let found = false;
                      const maxLookAhead = 5;
                      
                      for (let lookAhead = 1; lookAhead <= maxLookAhead && (previousSupportWordIndex + lookAhead) < allExpectedWords.length; lookAhead++) {
                        const futureWord = allExpectedWords[previousSupportWordIndex + lookAhead];
                        const cleanFutureWord = futureWord.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
                        
                        const isFutureMatch = cleanSpokenWord === cleanFutureWord ||
                                             cleanSpokenWord.includes(cleanFutureWord) ||
                                             cleanFutureWord.includes(cleanSpokenWord);
                        
                        if (isFutureMatch) {
                          found = true;
                          setSpokenWordsIndices(prev => new Set([...prev, previousSupportWordIndex + lookAhead]));
                          newIndex = previousSupportWordIndex + lookAhead + 1;
                          console.log('✓ Found word after support word skip:', futureWord);
                          lastWordTimeRef.current = Date.now();
                          
                          // Start progressive hints for next word
                          if (newIndex < allExpectedWords.length) {
                            startProgressiveHints(newIndex, allExpectedWords);
                          }
                          break;
                        }
                      }
                      
                      if (!found) {
                        newIndex = previousSupportWordIndex + 1;
                      }
                    } else {
                      // No support word was showing – treat this as skipping the current word
                      // Mark as missed (red) ONLY if the word is hidden
                      if (currentHiddenIndices.has(newIndex)) {
                        setMissedWordsIndices(prev => new Set([...prev, newIndex]));
                        console.log('❌ Hidden word marked as missed due to mismatch:', expectedWord, 'at index', newIndex);
                      } else {
                        console.log('⏭️ Visible word skipped (no red mark):', expectedWord, 'at index', newIndex);
                      }
                      newIndex++;
                    }
                  }
                }
              }
              
              return newIndex;
            });
            
            return transcriptWords.length; // Update processed length
          });
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
          title: "Limited Support",
          description: "Real-time word tracking is not available on this device. Your speech will be analyzed after recording.",
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
    
    // Stop Web Speech API
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    // Clear hesitation timer
    if (hesitationTimerRef.current) {
      clearTimeout(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    // Clear the transcription interval
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    lastProcessedChunkIndex.current = 0;
    
    // Reset spoken words tracking
    setSpokenWordsIndices(new Set());
    setHesitatedWordsIndices(new Set());
    setMissedWordsIndices(new Set());
    setCompletedSegments(new Set());
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

          // Detect language from speech text
          const { detectTextLanguage } = await import('@/utils/languageDetection');
          const detectedLang = detectTextLanguage(speech!.text_current) || 'en';
          console.log('Using language for analysis:', detectedLang);

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
              language: detectedLang,
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

          setSessionResults(data);
          
          // Delay showing results for smooth transition
          setTimeout(() => {
            setIsProcessing(false);
            setShowResults(true);
          }, 500);

          // Save practice session to database
          const { error: sessionError } = await supabase
            .from('practice_sessions')
            .insert({
              speech_id: speech!.id,
              score: data.accuracy,
              missed_words: data.missedWords,
              delayed_words: data.delayedWords,
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
                  title: "🎉 Segments Merged!",
                  description: "Great work! Both segments are now merged into your learning flow.",
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
          try {
            const { error: masteryError } = await supabase.functions.invoke('update-segment-word-mastery', {
              body: {
                speechId: speech!.id,
                segmentId: currentSegmentId,
                missedWords: data.missedWords || [],
                hesitatedWords: data.delayedWords || [],
                missedIndices: Array.from(missedWordsIndices),
                hesitatedIndices: Array.from(hesitatedWordsIndices),
                hiddenIndices: hiddenIndices
              }
            });

            if (masteryError) {
              console.error('Error updating segment word mastery:', masteryError);
            } else {
              console.log('✅ Segment word mastery updated with hidden word tracking');
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
            title: "Analysis complete!",
            description: `${data.accuracy}% accuracy.`,
          });
        } catch (innerError: any) {
          console.error('Error in analysis:', innerError);
          toast({
            variant: "destructive",
            title: "Analysis failed",
            description: innerError.message || "Failed to analyze your recording. Please try again.",
          });
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: "Failed to read audio file. Please try again.",
        });
        setIsProcessing(false);
      };

    } catch (error: any) {
      console.error('Error processing recording:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message || "Failed to process your recording. Please try again.",
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
        title: "Script updated",
        description: "Your speech text has been saved.",
      });
      
      setIsEditingScript(false);
      
      // Update local state immediately for practice
      setActiveSegmentText(editedScriptText.trim());
      loadSpeech(); // Reload to get fresh data
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to save",
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
        {/* Space background stars */}
        <div className="fixed inset-0 pointer-events-none z-0">
          {Array.from({ length: 100 }).map((_, i) => {
            const starColors = theme === 'light' 
              ? ['hsl(217, 91%, 50%)', 'hsl(270, 100%, 60%)', 'hsl(330, 100%, 60%)', 'hsl(180, 100%, 50%)', 'hsl(240, 10%, 30%)']
              : ['hsl(217, 91%, 60%)', 'hsl(270, 100%, 70%)', 'hsl(330, 100%, 70%)', 'hsl(180, 100%, 60%)', 'white'];
            
            return (
              <div
                key={i}
                className="absolute rounded-full animate-pulse"
                style={{
                  width: Math.random() * 2 + 1 + 'px',
                  height: Math.random() * 2 + 1 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                  background: starColors[Math.floor(Math.random() * starColors.length)],
                  opacity: theme === 'light' ? Math.random() * 0.3 + 0.15 : Math.random() * 0.5 + 0.2,
                  animationDuration: Math.random() * 3 + 2 + 's',
                  animationDelay: Math.random() * 2 + 's',
                  boxShadow: theme === 'light' ? '0 0 4px currentColor' : '0 0 8px currentColor',
                }}
              />
            );
          })}
        </div>
        <LoadingOverlay isVisible={isProcessing} />
        
        {/* Exit button */}
        <div className="absolute top-4 left-4 z-10">
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
            className="rounded-full hover:bg-card/80 backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Removed: Giant overlay popup - hints now appear inline in BracketedTextDisplay */}

        {/* Centered text content */}
        <div className="flex-1 flex items-center justify-center px-8 pb-32">
          <div className="max-w-4xl w-full">
            <BracketedTextDisplay
              text={activeSegmentText || speech.text_original}
              visibilityPercent={speech.base_word_visibility_percent || 100}
              spokenWordsIndices={spokenWordsIndices}
              hesitatedWordsIndices={hesitatedWordsIndices}
              missedWordsIndices={missedWordsIndices}
              currentWordIndex={expectedWordIndex}
              isRecording={isRecording}
              hintingWordIndex={supportWordIndex ?? -1}
              hintLevel={hintLevel}
              onPeekWord={(index) => {
                // Mark peeked words as hesitated
                setHesitatedWordsIndices(prev => new Set([...prev, index]));
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
                Stop Recording
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Start Recording
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
            <h1 className="text-3xl font-bold mb-2">Practice Complete</h1>
            <p className="text-lg text-muted-foreground">Here's how you did</p>
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
            />
          </div>

          {/* Automatic Schedule Info */}
          {adaptiveScheduleResult && (
            <Card className="mt-8 border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 animate-fade-in">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Target className="h-5 w-5" />
                    <span className="font-semibold text-lg">Next Practice</span>
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
                        <span className="text-xs">Weighted Score</span>
                      </div>
                      <span className="font-semibold">{Math.round(adaptiveScheduleResult.weightedAccuracy)}%</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">Script Visible</span>
                      </div>
                      <span className="font-semibold">{Math.round(speech.base_word_visibility_percent || 100)}%</span>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                        <Target className="h-3 w-3" />
                        <span className="text-xs">Stage</span>
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
              Back to Dashboard
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
                Back to Dashboard
              </Button>
              {speech && (
                <>
                  <div className="border-l pl-4 hidden md:block">
                    <h1 className="text-lg font-semibold capitalize">{speech.title}</h1>
                    {speech.goal_date && (
                      <p className="text-sm text-muted-foreground">
                        Goal: {format(new Date(speech.goal_date), "PPP")}
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
                Edit Script
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/presentation/${id}`)}
              >
                <Presentation className="h-4 w-4 mr-2" />
                Presentation Mode
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
                        ? `Learning Segment ${activeSegmentIndices[0] + 1} of ${segments.length}` 
                        : `Merging Segments ${activeSegmentIndices[0] + 1} & ${activeSegmentIndices[1] + 1}`}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {activeSegmentIndices.length === 1
                        ? `Practicing ${Math.ceil(activeSegmentText.split(/\s+/).length)} words - Master this, then we'll merge it with the next section`
                        : `Great progress! Combining ${Math.ceil(activeSegmentText.split(/\s+/).length)} words from mastered segments`}
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
                    <h3 className="font-semibold text-lg">Practice Full Speech</h3>
                    <p className="text-sm text-muted-foreground">
                      {speech.text_original.split(/\s+/).length} words total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
              <CardDescription>Track your memorization journey</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Words Memorized</span>
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
                  <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <p className="font-medium">
                        AI-Recommended Practice Time
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-primary">
                      <LockCountdown nextReviewDate={nextReviewDate} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Optimal spacing strengthens memory retention
                    </p>
                  </div>
                )}
                <Button 
                  size="lg" 
                  onClick={handleStartPractice}
                  className="rounded-full px-8"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {isLocked ? "Practice Anyway" : "Start Practice"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Script Dialog */}
      <Dialog open={isEditingScript} onOpenChange={setIsEditingScript}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Script</DialogTitle>
            <DialogDescription>
              Make changes to your speech text. This will reset your memorization progress.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editedScriptText}
            onChange={(e) => setEditedScriptText(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Enter your speech text..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingScript(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveScript}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Practice;
