import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Layers, RotateCcw, CheckCircle2 } from "lucide-react";

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
}

interface DayAfterRecallViewProps {
  speechId: string;
  onComplete?: () => void;
  onExit?: () => void;
}

const DayAfterRecallView = ({ speechId, onComplete, onExit }: DayAfterRecallViewProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  // Data
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState(true);
  const [speechLang, setSpeechLang] = useState<string>('en-US');
  
  // Session state
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [isStable, setIsStable] = useState(false); // User completed without any keyword help
  
  // Keyword support
  const [showKeyword, setShowKeyword] = useState<string | null>(null);
  const [keywordsShownThisAttempt, setKeywordsShownThisAttempt] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  // Blue pacing pulse
  const [pulseIndex, setPulseIndex] = useState(0);
  
  // Tracking
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const lastWordTimeRef = useRef<number>(Date.now());
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pulseIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);
  const currentWordIndexRef = useRef(0);
  const wordsRef = useRef<string[]>([]);
  
  // Get full text from all mastered beats
  const getFullText = useCallback(() => {
    const masteredBeats = beats.filter(b => b.is_mastered);
    return masteredBeats
      .map(b => `${b.sentence_1_text} ${b.sentence_2_text} ${b.sentence_3_text}`)
      .join(' ')
      .trim();
  }, [beats]);
  
  const fullText = getFullText();
  const words = fullText.split(/\s+/).filter(w => w.trim());
  
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);
  
  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);
  
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
    const { data: beatsData } = await supabase
      .from('practice_beats')
      .select('*')
      .eq('speech_id', speechId)
      .order('beat_order', { ascending: true });
    
    if (beatsData) {
      setBeats(beatsData as Beat[]);
      
      // Check if there are any mastered beats to recall
      const mastered = beatsData.filter(b => b.is_mastered);
      if (mastered.length === 0) {
        toast({
          title: t('day_after_recall.no_mastered_beats', 'No mastered beats'),
          description: t('day_after_recall.learn_first', 'First master some beats before using Day-After Recall.'),
        });
        onExit?.();
        return;
      }
    }
    
    setLoading(false);
  };
  
  // Normalize word for comparison
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
    
    // Allow minor typos
    if (e.length > 3) {
      let diff = 0;
      for (let i = 0; i < Math.max(s.length, e.length); i++) {
        if (s[i] !== e[i]) diff++;
      }
      if (diff <= 1) return true;
    }
    
    return false;
  };
  
  // Get next keyword (simple heuristic: longer/important words)
  const getNextKeyword = (fromIndex: number): { word: string; index: number } | null => {
    const ws = wordsRef.current;
    if (fromIndex >= ws.length) return null;
    
    // Find next "important" word (length > 4, not common)
    const commonWords = new Set(['the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with', 'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were']);
    
    for (let i = fromIndex; i < Math.min(fromIndex + 5, ws.length); i++) {
      const word = ws[i];
      const clean = normalizeWord(word);
      if (clean.length > 4 || !commonWords.has(clean)) {
        return { word, index: i };
      }
    }
    
    // Just return the next word if no keyword found
    return { word: ws[fromIndex], index: fromIndex };
  };
  
  // Show keyword support
  const triggerKeywordSupport = useCallback(() => {
    if (showKeyword) return; // Already showing
    
    const nextKw = getNextKeyword(currentWordIndexRef.current);
    if (nextKw) {
      setShowKeyword(nextKw.word);
      setKeywordsShownThisAttempt(prev => prev + 1);
    }
  }, [showKeyword]);
  
  // Handle tap for manual keyword trigger
  const handleTap = () => {
    if (isRecording && !showKeyword) {
      triggerKeywordSupport();
    }
  };
  
  // Process transcription
  const processTranscription = useCallback((transcript: string) => {
    const rawWords = transcript.split(/\s+/).filter(w => w.trim());
    if (rawWords.length === 0) return;
    
    const ws = wordsRef.current;
    let idx = currentWordIndexRef.current;
    
    // Check recent spoken words
    const recentWords = rawWords.slice(-6);
    
    for (const spoken of recentWords) {
      if (idx >= ws.length) break;
      
      // Check if matches expected word (or next few)
      for (let i = idx; i < Math.min(idx + 4, ws.length); i++) {
        if (wordsMatch(spoken, ws[i])) {
          // User said the word - hide keyword if showing
          if (showKeyword && i === currentWordIndexRef.current) {
            setShowKeyword(null);
          }
          
          idx = i + 1;
          currentWordIndexRef.current = idx;
          setCurrentWordIndex(idx);
          lastWordTimeRef.current = Date.now();
          break;
        }
      }
    }
    
    // Check completion
    if (idx >= ws.length) {
      handleAttemptComplete();
    }
  }, [showKeyword]);
  
  // Handle attempt completion
  const handleAttemptComplete = useCallback(() => {
    stopRecording();
    
    if (keywordsShownThisAttempt === 0) {
      // User completed without any keyword help - speech is stable!
      setIsStable(true);
    } else {
      // Needs another attempt
      toast({
        title: t('day_after_recall.attempt_complete', 'Good! Let\'s try again'),
        description: t('day_after_recall.fewer_stops', `You needed ${keywordsShownThisAttempt} keyword(s). Try to need fewer this time.`),
      });
      
      // Reset for next attempt
      setTimeout(() => {
        setAttemptNumber(prev => prev + 1);
        setCurrentWordIndex(0);
        currentWordIndexRef.current = 0;
        setKeywordsShownThisAttempt(0);
        setShowKeyword(null);
        setPulseIndex(0);
        startRecording();
      }, 2000);
    }
  }, [keywordsShownThisAttempt, t, toast]);
  
  // Start recording
  const startRecording = useCallback(async () => {
    if (recognitionRef.current) return;
    
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        toast({
          variant: "destructive",
          title: "Not Supported",
          description: "Speech recognition is not supported in this browser.",
        });
        return;
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;
      
      transcriptRef.current = "";
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let fullTranscript = "";
        
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          fullTranscript += (res?.[0]?.transcript ?? "") + " ";
        }
        
        transcriptRef.current = fullTranscript.trim();
        processTranscription(transcriptRef.current);
        
        // Reset silence timer
        lastWordTimeRef.current = Date.now();
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };
      
      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // ignore
          }
        }
      };
      
      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      setIsRecording(true);
      recognition.start();
      
      lastWordTimeRef.current = Date.now();
      
      // Silence detection - trigger keyword after 3 seconds
      silenceTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastWordTimeRef.current;
        if (elapsed > 3000 && !showKeyword) {
          triggerKeywordSupport();
        }
      }, 500);
      
      // Blue pacing pulse - moves through words at ~2 words/second
      pulseIntervalRef.current = setInterval(() => {
        setPulseIndex(prev => {
          const next = prev + 1;
          if (next >= wordsRef.current.length) {
            return prev; // Stop at end
          }
          return next;
        });
      }, 500);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [speechLang, processTranscription, showKeyword, triggerKeywordSupport, toast]);
  
  // Stop recording
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }
  }, []);
  
  // Auto-start on load
  useEffect(() => {
    if (!loading && beats.length > 0 && !isRecording && !isStable) {
      startRecording();
    }
    
    return () => {
      stopRecording();
    };
  }, [loading, beats.length]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  // Success screen
  if (isStable) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
        >
          <Award className="h-20 w-20 text-primary" />
        </motion.div>
        
        <h2 className="text-2xl font-bold">
          {t('day_after_recall.stable', '🎉 Speech is stable!')}
        </h2>
        
        <p className="text-muted-foreground max-w-md">
          {t('day_after_recall.stable_desc', 'You completed the entire speech without needing any keyword support. Your memory is consolidated!')}
        </p>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <Layers className="h-4 w-4" />
          <span>{t('day_after_recall.attempts', `Completed in ${attemptNumber} attempt(s)`)}</span>
        </div>
        
        <Button onClick={onComplete || onExit} className="mt-6">
          {t('common.done', 'Done')}
        </Button>
      </div>
    );
  }
  
  return (
    <div 
      className="flex flex-col h-full p-4 relative"
      onClick={handleTap}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-500/20 text-blue-500">
            {t('day_after_recall.title', '🌅 Day-After Recall')}
          </div>
          <span className="text-sm text-muted-foreground">
            {t('day_after_recall.attempt', 'Attempt')} {attemptNumber}
          </span>
        </div>
        
        {keywordsShownThisAttempt > 0 && (
          <div className="text-sm text-muted-foreground">
            {t('day_after_recall.keywords_shown', 'Keywords shown')}: {keywordsShownThisAttempt}
          </div>
        )}
      </div>
      
      {/* Main area - Blue pacing pulse only */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* Blue pacing pulse indicator */}
        <motion.div
          className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-8"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-8 h-8 rounded-full bg-blue-500" />
        </motion.div>
        
        {/* Progress indicator */}
        <div className="text-sm text-muted-foreground mb-4">
          {currentWordIndex} / {words.length} {t('day_after_recall.words', 'words')}
        </div>
        
        {/* Keyword hint - shown discretely when needed */}
        <AnimatePresence>
          {showKeyword && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2"
            >
              <div className="text-lg text-muted-foreground font-normal px-4 py-2">
                {showKeyword}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Tap hint */}
        <div className="absolute bottom-16 text-xs text-muted-foreground/60">
          {t('day_after_recall.tap_hint', 'Tap anywhere for keyword hint')}
        </div>
      </div>
      
      {/* Exit button */}
      <div className="flex justify-center">
        <Button variant="ghost" onClick={onExit}>
          {t('common.exit', 'Exit')}
        </Button>
      </div>
    </div>
  );
};

export default DayAfterRecallView;
