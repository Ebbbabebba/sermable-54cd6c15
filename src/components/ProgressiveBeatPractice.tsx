import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RotateCcw, Lightbulb, CheckCircle2, Layers, ScrollText, Award, X, Circle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
  practice_stage: 'day1_sentences' | 'day2_beats' | 'day3_fullspeech' | 'day4_adaptive';
  words_hidden_per_round: number;
  stage_started_at: string | null;
  consecutive_perfect_recalls: number;
}

interface ProgressiveBeatPracticeProps {
  speechId: string;
  onComplete?: () => void;
  onExit?: () => void;
}

type PracticeStage = 'day1_sentences' | 'day2_beats' | 'day3_fullspeech' | 'day4_adaptive';

// Common words to fade first (prioritize hiding these)
const COMMON_WORDS = new Set(['the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with', 'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'och', 'att', 'det', 'en', 'ett', 'som', 'på', 'av', 'med', 'för', 'den', 'de', 'om', 'så', 'han', 'hon', 'vi', 'ni', 'jag', 'du']);

// Stage configuration
const STAGE_CONFIG: Record<PracticeStage, { wordsPerRound: number; startHidden: boolean; description: string }> = {
  'day1_sentences': { wordsPerRound: 1, startHidden: false, description: 'Learning sentences' },
  'day2_beats': { wordsPerRound: 2, startHidden: false, description: 'Beat-level practice' },
  'day3_fullspeech': { wordsPerRound: 4, startHidden: false, description: 'Full speech practice' },
  'day4_adaptive': { wordsPerRound: 0, startHidden: true, description: 'Memory recall' },
};

const ProgressiveBeatPractice = ({ speechId, onComplete, onExit }: ProgressiveBeatPracticeProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Data state
  const [beats, setBeats] = useState<Beat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speechLang, setSpeechLang] = useState<string>('en-US');
  
  // Stage state
  const [currentStage, setCurrentStage] = useState<PracticeStage>('day1_sentences');
  const [practiceText, setPracticeText] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  
  // Word tracking
  const [hiddenWordIndices, setHiddenWordIndices] = useState<Set<number>>(new Set());
  const [hiddenWordOrder, setHiddenWordOrder] = useState<number[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [spokenIndices, setSpokenIndices] = useState<Set<number>>(new Set());
  const [hesitatedIndices, setHesitatedIndices] = useState<Set<number>>(new Set());
  const [missedIndices, setMissedIndices] = useState<Set<number>>(new Set());
  const [perfectRecallCount, setPerfectRecallCount] = useState(0);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState("");
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const runningTranscriptRef = useRef<string>("");
  const lastWordTimeRef = useRef<number>(Date.now());
  const hesitationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const currentWordIndexRef = useRef(0);
  const hiddenWordIndicesRef = useRef<Set<number>>(new Set());
  const spokenIndicesRef = useRef<Set<number>>(new Set());
  const hesitatedIndicesRef = useRef<Set<number>>(new Set());
  const missedIndicesRef = useRef<Set<number>>(new Set());
  const wordsRef = useRef<string[]>([]);
  const showCelebrationRef = useRef(false);
  const ignoreResultsUntilRef = useRef(0);
  const repetitionIdRef = useRef(0);
  const lastCompletionRepIdRef = useRef(-1);
  
  // Sync refs
  useEffect(() => { currentWordIndexRef.current = currentWordIndex; }, [currentWordIndex]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { hiddenWordIndicesRef.current = hiddenWordIndices; }, [hiddenWordIndices]);
  useEffect(() => { spokenIndicesRef.current = spokenIndices; }, [spokenIndices]);
  useEffect(() => { hesitatedIndicesRef.current = hesitatedIndices; }, [hesitatedIndices]);
  useEffect(() => { missedIndicesRef.current = missedIndices; }, [missedIndices]);
  useEffect(() => { showCelebrationRef.current = showCelebration; }, [showCelebration]);
  
  const words = practiceText.split(/\s+/).filter(w => w.trim());
  useEffect(() => { wordsRef.current = words; }, [words]);

  // Get current beat
  const currentBeat = beats[currentBeatIndex] || null;
  
  // Load beats on mount
  useEffect(() => {
    loadBeats();
  }, [speechId]);
  
  const loadBeats = async () => {
    setLoading(true);
    
    // Get speech language
    const { data: speechRow } = await supabase
      .from('speeches')
      .select('speech_language')
      .eq('id', speechId)
      .single();
    
    if (speechRow?.speech_language) {
      setSpeechLang(speechRow.speech_language);
    }
    
    // Get all beats
    const { data: beatsData, error } = await supabase
      .from('practice_beats')
      .select('*')
      .eq('speech_id', speechId)
      .order('beat_order', { ascending: true });
    
    if (error) {
      console.error('Error loading beats:', error);
      setLoading(false);
      return;
    }
    
    if (beatsData && beatsData.length > 0) {
      // Cast to Beat type with defaults for new columns
      const typedBeats: Beat[] = beatsData.map(b => ({
        ...b,
        practice_stage: (b.practice_stage as PracticeStage) || 'day1_sentences',
        words_hidden_per_round: b.words_hidden_per_round || 1,
        consecutive_perfect_recalls: b.consecutive_perfect_recalls || 0,
      }));
      
      setBeats(typedBeats);
      
      // Determine which beats to practice based on their stage
      const today = new Date().toDateString();
      
      // Find beats that need practice today
      // Priority: day1 beats that aren't mastered, then day2+ beats for recall
      const unmasteredBeats = typedBeats.filter(b => !b.is_mastered);
      const masteredBeats = typedBeats.filter(b => b.is_mastered);
      
      // Check if mastered beats need recall (different day from stage_started_at)
      const beatsNeedingRecall = masteredBeats.filter(b => {
        if (!b.last_recall_at) return true;
        const lastRecall = new Date(b.last_recall_at);
        return lastRecall.toDateString() !== today;
      });
      
      if (beatsNeedingRecall.length > 0) {
        // Start with recall of mastered beats
        const beatToRecall = beatsNeedingRecall[0];
        setCurrentBeatIndex(typedBeats.findIndex(b => b.id === beatToRecall.id));
        setCurrentStage(beatToRecall.practice_stage);
        initializeStage(beatToRecall);
      } else if (unmasteredBeats.length > 0) {
        // Learn new beat
        const beatToLearn = unmasteredBeats[0];
        setCurrentBeatIndex(typedBeats.findIndex(b => b.id === beatToLearn.id));
        setCurrentStage(beatToLearn.practice_stage);
        initializeStage(beatToLearn);
      } else {
        // All done!
        setSessionComplete(true);
      }
    }
    
    setLoading(false);
  };
  
  // Initialize stage with correct text and hidden words
  const initializeStage = useCallback((beat: Beat) => {
    const stage = beat.practice_stage;
    const config = STAGE_CONFIG[stage];
    
    // Set practice text based on stage
    let text = "";
    if (stage === 'day1_sentences') {
      // Day 1: Start with first sentence only (handled by BeatPracticeView)
      text = `${beat.sentence_1_text} ${beat.sentence_2_text} ${beat.sentence_3_text}`;
    } else if (stage === 'day2_beats') {
      // Day 2: Full beat, start visible
      text = `${beat.sentence_1_text} ${beat.sentence_2_text} ${beat.sentence_3_text}`;
    } else if (stage === 'day3_fullspeech' || stage === 'day4_adaptive') {
      // Day 3+: Full speech from all mastered beats
      const masteredBeats = beats.filter(b => b.is_mastered || b.id === beat.id);
      text = masteredBeats
        .map(b => `${b.sentence_1_text} ${b.sentence_2_text} ${b.sentence_3_text}`)
        .join(' ');
    }
    
    setPracticeText(text);
    
    // Initialize hidden words based on stage
    const wordsList = text.split(/\s+/).filter(w => w.trim());
    
    if (config.startHidden) {
      // Day 4: Start fully hidden
      setHiddenWordIndices(new Set(wordsList.map((_, i) => i)));
      setHiddenWordOrder(wordsList.map((_, i) => i));
    } else {
      // Day 2-3: Start fully visible
      setHiddenWordIndices(new Set());
      setHiddenWordOrder([]);
    }
    
    resetWordTracking();
  }, [beats]);
  
  // Reset word tracking state
  const resetWordTracking = () => {
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
    transcriptRef.current = "";
    runningTranscriptRef.current = "";
    lastWordTimeRef.current = Date.now();
  };
  
  // Normalize word for comparison
  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  };
  
  // Check if words match
  const wordsMatch = (spoken: string, expected: string): boolean => {
    const s = normalizeWord(spoken);
    const e = normalizeWord(expected);
    if (s === e) return true;
    if (e.length > 3) {
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
      }
      if (diff <= 1) return true;
    }
    return false;
  };
  
  // Get next word to hide (priority order)
  const getNextWordToHide = useCallback((currentHidden: Set<number>): number | null => {
    const visibleIndices = words
      .map((_, i) => i)
      .filter(i => !currentHidden.has(i));
    
    if (visibleIndices.length === 0) return null;
    
    // Priority 1: Common words
    for (const idx of visibleIndices) {
      const word = words[idx].toLowerCase().replace(/[^a-zåäöü]/g, '');
      if (COMMON_WORDS.has(word)) return idx;
    }
    
    // Priority 2: Short words
    for (const idx of visibleIndices) {
      const word = words[idx].replace(/[^a-zA-ZåäöüÅÄÖÜ]/g, '');
      if (word.length >= 2 && word.length <= 4) return idx;
    }
    
    // Priority 3: Middle words
    const middleIndices = visibleIndices.filter(i => i > 0 && i < words.length - 1);
    if (middleIndices.length > 0) return middleIndices[0];
    
    return visibleIndices[0];
  }, [words]);
  
  // Process transcription
  const processTranscription = useCallback((transcript: string, isFinal: boolean, repId: number) => {
    if (repId !== repetitionIdRef.current) return;
    
    const rawWords = transcript.split(/\s+/).filter(w => w.trim());
    if (rawWords.length === 0) return;
    
    const currentIdx = currentWordIndexRef.current;
    if (currentIdx >= wordsRef.current.length) return;
    
    const prevLength = transcriptRef.current.split(/\s+/).filter(w => w.trim()).length;
    transcriptRef.current = transcript;
    
    const newWords = rawWords.slice(prevLength);
    const recentWords = rawWords.slice(Math.max(0, rawWords.length - 6));
    const wordsToCheck = newWords.length > 0 ? newWords : recentWords;
    
    let advancedTo = currentIdx;
    const newSpoken = new Set(spokenIndicesRef.current);
    
    for (const spoken of wordsToCheck) {
      if (advancedTo >= wordsRef.current.length) break;
      
      let foundIdx = -1;
      for (let i = advancedTo; i < Math.min(advancedTo + 3, wordsRef.current.length); i++) {
        if (wordsMatch(spoken, wordsRef.current[i])) {
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
    
    // Check completion
    if (advancedTo >= wordsRef.current.length) {
      if (lastCompletionRepIdRef.current === repId) return;
      lastCompletionRepIdRef.current = repId;
      
      const hadErrors = hesitatedIndicesRef.current.size > 0 || missedIndicesRef.current.size > 0;
      handleCompletion(newSpoken, hadErrors);
      return;
    }
    
    if (advancedTo > currentIdx) {
      currentWordIndexRef.current = advancedTo;
      setCurrentWordIndex(advancedTo);
      spokenIndicesRef.current = newSpoken;
      setSpokenIndices(newSpoken);
    }
  }, [wordsMatch]);
  
  // Handle completion of a round
  const handleCompletion = useCallback(async (spoken: Set<number>, hadErrors: boolean) => {
    pauseRecognition(1000);
    
    const config = STAGE_CONFIG[currentStage];
    const allHidden = hiddenWordIndices.size >= words.length;
    
    if (hadErrors) {
      // Had errors - reveal some words and retry
      setPerfectRecallCount(0);
      
      if (currentStage === 'day4_adaptive') {
        // In adaptive mode, reveal the word that was hesitated on
        // Words will be shown briefly then hidden again
        toast({
          title: t('progressive.try_again', 'Try again'),
          description: t('progressive.hesitation_detected', 'Keep practicing!'),
        });
      } else if (hiddenWordOrder.length > 0) {
        // Reveal last hidden words
        const wordsToReveal = Math.min(config.wordsPerRound, hiddenWordOrder.length);
        const indicesToReveal = hiddenWordOrder.slice(-wordsToReveal);
        
        setHiddenWordIndices(prev => {
          const next = new Set(prev);
          indicesToReveal.forEach(idx => next.delete(idx));
          return next;
        });
        setHiddenWordOrder(prev => prev.slice(0, -wordsToReveal));
      }
      
      resetWordTracking();
    } else if (!allHidden && currentStage !== 'day4_adaptive') {
      // No errors, hide more words (stages 2-3)
      let newHidden = new Set(hiddenWordIndices);
      let newOrder = [...hiddenWordOrder];
      
      for (let i = 0; i < config.wordsPerRound; i++) {
        const nextToHide = getNextWordToHide(newHidden);
        if (nextToHide !== null) {
          newHidden.add(nextToHide);
          newOrder.push(nextToHide);
        }
      }
      
      setHiddenWordIndices(newHidden);
      setHiddenWordOrder(newOrder);
      resetWordTracking();
    } else {
      // All hidden and no errors - perfect recall!
      const newPerfectCount = perfectRecallCount + 1;
      
      if (newPerfectCount >= 2) {
        // Two perfect recalls - beat mastered or stage complete!
        await handleBeatMastered();
      } else {
        setPerfectRecallCount(newPerfectCount);
        setCelebrationMessage(`${newPerfectCount}/2 ✓`);
        setShowCelebration(true);
        
        setTimeout(() => {
          setShowCelebration(false);
          resetWordTracking();
        }, 1000);
      }
    }
  }, [currentStage, hiddenWordIndices, hiddenWordOrder, perfectRecallCount, words.length, getNextWordToHide, t, toast]);
  
  // Handle beat mastered
  const handleBeatMastered = async () => {
    if (!currentBeat) return;
    
    // Determine next stage
    const stageOrder: PracticeStage[] = ['day1_sentences', 'day2_beats', 'day3_fullspeech', 'day4_adaptive'];
    const currentStageIndex = stageOrder.indexOf(currentStage);
    const nextStage = stageOrder[currentStageIndex + 1] || 'day4_adaptive';
    
    // Update beat in database
    const updateData: any = {
      is_mastered: true,
      mastered_at: new Date().toISOString(),
      last_recall_at: new Date().toISOString(),
      consecutive_perfect_recalls: 0,
    };
    
    // If not at final stage, advance to next
    if (currentStageIndex < stageOrder.length - 1) {
      updateData.practice_stage = nextStage;
      updateData.stage_started_at = new Date().toISOString();
      updateData.words_hidden_per_round = STAGE_CONFIG[nextStage].wordsPerRound;
    }
    
    await supabase
      .from('practice_beats')
      .update(updateData)
      .eq('id', currentBeat.id);
    
    // Update local state
    setBeats(prev => prev.map(b => 
      b.id === currentBeat.id ? { ...b, ...updateData } : b
    ));
    
    setCelebrationMessage("🏆 " + t('progressive.beat_mastered', 'Beat mastered!'));
    setShowCelebration(true);
    
    setTimeout(() => {
      setShowCelebration(false);
      setSessionComplete(true);
    }, 2000);
  };
  
  // Pause recognition
  const pauseRecognition = (ms: number) => {
    ignoreResultsUntilRef.current = Date.now() + ms;
    runningTranscriptRef.current = "";
    transcriptRef.current = "";
  };
  
  // Start recording
  const startRecording = async () => {
    if (recognitionRef.current) return;
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({
          variant: "destructive",
          title: t('common.not_supported', 'Not Supported'),
          description: t('common.use_chrome', 'Speech recognition requires Chrome or Safari.'),
        });
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        if (showCelebrationRef.current) return;
        if (Date.now() < ignoreResultsUntilRef.current) return;
        
        const repId = repetitionIdRef.current;
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
        const isFinal = event.results.length ? event.results[event.results.length - 1].isFinal : false;
        processTranscription(combined, isFinal, repId);
      };
      
      recognition.onerror = (e: any) => console.error('Recognition error:', e.error);
      
      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch {}
        }
      };
      
      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      setIsRecording(true);
      recognition.start();
      
      lastWordTimeRef.current = Date.now();
      
      // Hesitation detection (3 seconds)
      hesitationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastWordTimeRef.current;
        const idx = currentWordIndexRef.current;
        
        if (elapsed > 3000 && idx < wordsRef.current.length) {
          // Show word hint for adaptive mode
          if (currentStage === 'day4_adaptive' && hiddenWordIndicesRef.current.has(idx)) {
            // Temporarily reveal the word
            setHiddenWordIndices(prev => {
              const next = new Set(prev);
              next.delete(idx);
              return next;
            });
            setHesitatedIndices(prev => new Set([...prev, idx]));
            
            // Hide again after spoken
            setTimeout(() => {
              setHiddenWordIndices(prev => new Set([...prev, idx]));
            }, 2000);
          } else if (hiddenWordIndicesRef.current.has(idx)) {
            setHesitatedIndices(prev => new Set([...prev, idx]));
          }
        }
      }, 500);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };
  
  // Stop recording
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    
    if (hesitationTimerRef.current) {
      clearInterval(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
  }, []);
  
  // Auto-start recording
  useEffect(() => {
    if (loading || !currentBeat || showCelebration || sessionComplete) return;
    if (recognitionRef.current) return;
    
    startRecording();
  }, [loading, currentBeat?.id, showCelebration, sessionComplete]);
  
  // Cleanup
  useEffect(() => {
    return () => stopRecording();
  }, [stopRecording]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  // Session complete screen
  if (sessionComplete) {
    const masteredCount = beats.filter(b => b.is_mastered).length;
    const totalBeats = beats.length;
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <Award className="h-20 w-20 text-primary animate-pulse" />
        <h2 className="text-2xl font-bold">
          {masteredCount === totalBeats 
            ? t('progressive.all_complete', '🎉 Speech memorized!')
            : t('progressive.session_done', 'Session Complete!')}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {masteredCount === totalBeats
            ? t('progressive.come_back_tomorrow', 'Come back tomorrow to reinforce your memory!')
            : t('progressive.progress', `${masteredCount}/${totalBeats} beats mastered. Rest and return later!`)}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4" />
          <span>{t('progressive.sleep_tip', 'Sleep consolidates memories better than repetition')}</span>
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
        <p className="text-muted-foreground">{t('progressive.no_beats', 'No beats found')}</p>
        <Button onClick={onExit} className="mt-4">{t('common.back', 'Back')}</Button>
      </div>
    );
  }
  
  const config = STAGE_CONFIG[currentStage];
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => { stopRecording(); onExit?.(); }} className="shrink-0 rounded-full">
            <X className="h-5 w-5 text-muted-foreground" />
          </Button>
          
          <div className="flex-1">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(hiddenWordIndices.size / Math.max(words.length, 1)) * 100}%` }}
              />
            </div>
          </div>
          
          <div className={cn(
            "shrink-0 px-3 py-1 rounded-full text-xs font-semibold",
            currentStage === 'day4_adaptive' ? "bg-purple-500/20 text-purple-500" : "bg-primary/20 text-primary"
          )}>
            {currentStage === 'day4_adaptive' ? <EyeOff className="h-3 w-3 inline mr-1" /> : <Eye className="h-3 w-3 inline mr-1" />}
            {config.description}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl space-y-6">
          {/* Stage indicator */}
          <div className="flex justify-center">
            <span className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              currentStage === 'day4_adaptive' && "bg-purple-500/10 text-purple-500",
              currentStage !== 'day4_adaptive' && "bg-primary/10 text-primary"
            )}>
              <Layers className="h-4 w-4" />
              {words.length - hiddenWordIndices.size} / {words.length} visible
            </span>
          </div>
          
          {/* Main card */}
          <div className="bg-card rounded-3xl border border-border/50 shadow-lg p-6 md:p-10">
            <AnimatePresence mode="wait">
              {showCelebration ? (
                <motion.div
                  key="celebration"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="flex flex-col items-center gap-6 py-8"
                >
                  <Lightbulb className="h-16 w-16 text-primary animate-pulse" />
                  <p className="text-2xl font-bold text-primary text-center">{celebrationMessage}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full"
                >
                  {currentStage === 'day4_adaptive' && hiddenWordIndices.size === words.length ? (
                    // Day 4: Show pulsing indicator when fully hidden
                    <div className="flex flex-col items-center gap-6 py-8">
                      <motion.div
                        className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
                        animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary" />
                      </motion.div>
                      <p className="text-muted-foreground text-center">
                        {t('progressive.recite_from_memory', 'Recite from memory. Tap if stuck.')}
                      </p>
                    </div>
                  ) : (
                    <SentenceDisplay
                      text={practiceText}
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
                          setHesitatedIndices(prev => new Set([...prev, idx]));
                        }
                      }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Progress */}
          {!showCelebration && (
            <div className="flex justify-center">
              <div className="flex items-center gap-4">
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
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
                  <CheckCircle2 className={cn(
                    "absolute inset-0 m-auto w-6 h-6 transition-colors",
                    hiddenWordIndices.size === words.length ? "text-primary" : "text-muted-foreground/30"
                  )} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{perfectRecallCount}/2 perfect</p>
                  <p className="text-xs text-muted-foreground">{t('progressive.perfect_needed', 'Need 2 perfect recalls')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom controls */}
      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent p-4 pb-6">
        <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
          {!showCelebration && (
            <Button
              variant="default"
              size="lg"
              onClick={() => {
                setPerfectRecallCount(0);
                setHiddenWordIndices(new Set());
                setHiddenWordOrder([]);
                resetWordTracking();
              }}
              className="rounded-full px-6"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              {t('common.restart', 'Restart')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressiveBeatPractice;
