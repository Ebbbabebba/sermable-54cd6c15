import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, RotateCcw, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";
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
}

interface BeatPracticeViewProps {
  speechId: string;
  onComplete?: () => void;
  onExit?: () => void;
}

type Phase = 'sentence_1_learning' | 'sentence_1_fading' | 'sentence_2_learning' | 'sentence_2_fading' | 'sentence_3_learning' | 'sentence_3_fading' | 'beat_combining';

// Common words to fade first
const COMMON_WORDS = new Set(['the', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'it', 'that', 'for', 'on', 'with', 'as', 'at', 'by', 'this', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can']);

const BeatPracticeView = ({ speechId, onComplete, onExit }: BeatPracticeViewProps) => {
  const { t } = useTranslation();
  
  // Beats data
  const [beats, setBeats] = useState<Beat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [speechLang, setSpeechLang] = useState<string>(() => (typeof navigator !== 'undefined' ? navigator.language : 'en-US'));
  
  // Phase tracking
  const [phase, setPhase] = useState<Phase>('sentence_1_learning');
  const [repetitionCount, setRepetitionCount] = useState(1);
  
  // Word tracking
  const [hiddenWordIndices, setHiddenWordIndices] = useState<Set<number>>(new Set());
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [spokenIndices, setSpokenIndices] = useState<Set<number>>(new Set());
  const [hesitatedIndices, setHesitatedIndices] = useState<Set<number>>(new Set());
  const [missedIndices, setMissedIndices] = useState<Set<number>>(new Set());
  const [failedWordIndices, setFailedWordIndices] = useState<Set<number>>(new Set()); // Words to restore next rep
  
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

  // Refs to avoid stale closures in timers / callbacks
  const currentWordIndexRef = useRef(0);
  const isRecordingRef = useRef(false);
  const hiddenWordIndicesRef = useRef<Set<number>>(new Set());
  const wordsLengthRef = useRef(0);
  const showCelebrationRef = useRef(false);
  const processTranscriptionRef = useRef<(transcript: string, isFinal: boolean) => void>(() => {});

  useEffect(() => {
    currentWordIndexRef.current = currentWordIndex;
  }, [currentWordIndex]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    hiddenWordIndicesRef.current = hiddenWordIndices;
  }, [hiddenWordIndices]);

  // Get current beat
  const currentBeat = beats[currentBeatIndex];
  
  // Get current sentence text based on phase
  const getCurrentText = useCallback(() => {
    if (!currentBeat) return "";
    
    if (phase === 'beat_combining') {
      return `${currentBeat.sentence_1_text} ${currentBeat.sentence_2_text} ${currentBeat.sentence_3_text}`;
    }
    
    if (phase.startsWith('sentence_1')) return currentBeat.sentence_1_text;
    if (phase.startsWith('sentence_2')) return currentBeat.sentence_2_text;
    if (phase.startsWith('sentence_3')) return currentBeat.sentence_3_text;
    
    return "";
  }, [currentBeat, phase]);

  const currentText = getCurrentText();
  const words = currentText.split(/\s+/).filter(w => w.trim());

  useEffect(() => {
    wordsLengthRef.current = words.length;
  }, [words.length]);

  useEffect(() => {
    showCelebrationRef.current = showCelebration;
  }, [showCelebration]);

  // Get sentence number (1, 2, or 3)
  const getCurrentSentenceNumber = () => {
    if (phase.startsWith('sentence_1')) return 1;
    if (phase.startsWith('sentence_2')) return 2;
    if (phase.startsWith('sentence_3')) return 3;
    return 1;
  };

  // Get phase type (learning, fading, combining)
  const getPhaseType = (): 'learning' | 'fading' | 'combining' => {
    if (phase.includes('learning')) return 'learning';
    if (phase.includes('fading')) return 'fading';
    return 'combining';
  };

  // Load beats on mount
  useEffect(() => {
    loadOrCreateBeats();
  }, [speechId]);

  const loadOrCreateBeats = async () => {
    setLoading(true);

    // Fetch speech language (helps speech recognition)
    const { data: speechRow } = await supabase
      .from('speeches')
      .select('speech_language')
      .eq('id', speechId)
      .single();

    if (speechRow?.speech_language) {
      // Use BCP-47-ish tags if possible; default to browser language otherwise
      setSpeechLang(speechRow.speech_language);
    }
    
    // Try to load existing beats
    const { data: existingBeats, error } = await supabase
      .from('practice_beats')
      .select('*')
      .eq('speech_id', speechId)
      .order('beat_order', { ascending: true });
    
    if (error) {
      console.error('Error loading beats:', error);
    }
    
    if (existingBeats && existingBeats.length > 0) {
      setBeats(existingBeats);
      // Find first non-mastered beat
      const firstUnmastered = existingBeats.findIndex(b => !b.is_mastered);
      setCurrentBeatIndex(firstUnmastered >= 0 ? firstUnmastered : 0);
    } else {
      // Create beats using edge function
      try {
        const { data, error: fnError } = await supabase.functions.invoke('segment-speech-into-beats', {
          body: { speechId },
        });
        
        if (fnError) throw fnError;
        
        if (data?.beats) {
          setBeats(data.beats);
        }
      } catch (error) {
        console.error('Error creating beats:', error);
      }
    }
    
    setLoading(false);
  };

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

  // Process transcription - align spoken words to the script in order
  const processTranscription = useCallback((transcript: string, isFinal: boolean) => {
    transcriptRef.current = transcript;
    const spokenWords = transcript.split(/\s+/).filter((w) => w.trim());
    if (spokenWords.length === 0) return;

    // Recompute progress from scratch each time (Web Speech API provides cumulative transcripts)
    const computedSpoken = new Set<number>();
    const computedMissed = new Set<number>();
    const computedFailed = new Set<number>();

    let expected = 0;

    for (const spoken of spokenWords) {
      if (expected >= words.length) break;

      let foundIdx = -1;
      for (let i = expected; i < Math.min(expected + 4, words.length); i++) {
        if (wordsMatch(spoken, words[i])) {
          foundIdx = i;
          break;
        }
      }

      if (foundIdx === -1) continue;

      // Mark skipped words
      for (let j = expected; j < foundIdx; j++) {
        computedSpoken.add(j);
        const isHidden = hiddenWordIndicesRef.current.has(j);
        // Only mark as missed/failed if the word is HIDDEN (not visible)
        if (isHidden) {
          computedMissed.add(j);
          computedFailed.add(j);
        }
      }

      // Mark matched word
      computedSpoken.add(foundIdx);
      expected = foundIdx + 1;
      lastWordTimeRef.current = Date.now();
    }

    // Keep progress monotonic during interim updates
    const nextIndex = Math.max(currentWordIndexRef.current, expected);

    if (nextIndex !== currentWordIndexRef.current) {
      currentWordIndexRef.current = nextIndex;
      setCurrentWordIndex(nextIndex);
    }

    setSpokenIndices(computedSpoken);
    setMissedIndices(computedMissed);
    setFailedWordIndices(computedFailed);

    // Check if sentence/beat complete
    if (isFinal || computedSpoken.size === words.length) {
      checkCompletion(computedSpoken, computedFailed);
    }
  }, [words, wordsMatch, checkCompletion]);

  // Check if current phase is complete
  function checkCompletion(spoken: Set<number>, failed?: Set<number>) {
    const allSpoken = words.every((_, i) => spoken.has(i));

    if (!allSpoken) return;

    // Check for errors (missed hidden words)
    const hadErrors = (failed ?? failedWordIndices).size > 0;

    if (phase.includes('learning')) {
      // Learning phase: need 3 clean reads
      if (repetitionCount >= 3) {
        // Move to fading phase
        const nextPhase = phase.replace('learning', 'fading') as Phase;
        transitionToPhase(nextPhase);
      } else {
        // Next repetition
        setRepetitionCount((prev) => prev + 1);
        resetForNextRep();
      }
    } else if (phase.includes('fading')) {
      if (hadErrors) {
        // Restore failed words and retry
        const restored = new Set(hiddenWordIndices);
        (failed ?? failedWordIndices).forEach((i) => restored.delete(i));
        setHiddenWordIndices(restored);
        setFailedWordIndices(new Set());
        resetForNextRep();
      } else if (hiddenWordIndices.size < words.length) {
        // Hide one more word
        const nextToHide = getNextWordToHide(hiddenWordIndices);
        if (nextToHide !== null) {
          setHiddenWordIndices((prev) => new Set([...prev, nextToHide]));
        }
        resetForNextRep();
      } else {
        // All words hidden and recited correctly = sentence mastered!
        showSentenceCelebration();
      }
    } else if (phase === 'beat_combining') {
      if (hadErrors) {
        // Restore failed words and retry
        const restored = new Set(hiddenWordIndices);
        (failed ?? failedWordIndices).forEach((i) => restored.delete(i));
        setHiddenWordIndices(restored);
        setFailedWordIndices(new Set());
        resetForNextRep();
      } else if (hiddenWordIndices.size < words.length) {
        // Hide one more word
        const nextToHide = getNextWordToHide(hiddenWordIndices);
        if (nextToHide !== null) {
          setHiddenWordIndices((prev) => new Set([...prev, nextToHide]));
        }
        resetForNextRep();
      } else {
        // Beat complete!
        showBeatCelebration();
      }
    }
  }

  const resetForNextRep = () => {
    currentWordIndexRef.current = 0;
    setCurrentWordIndex(0);
    setSpokenIndices(new Set());
    setHesitatedIndices(new Set());
    setMissedIndices(new Set());
    setFailedWordIndices(new Set());
    transcriptRef.current = "";
    runningTranscriptRef.current = "";
  };

  const transitionToPhase = (newPhase: Phase) => {
    setPhase(newPhase);
    setRepetitionCount(1);
    setHiddenWordIndices(new Set());
    resetForNextRep();
  };

  const showSentenceCelebration = () => {
    setCelebrationMessage(t('beat_practice.excellent_next'));
    setShowCelebration(true);
    
    setTimeout(() => {
      setShowCelebration(false);
      
      // Move to next sentence or combining phase
      if (phase === 'sentence_1_fading') {
        transitionToPhase('sentence_2_learning');
      } else if (phase === 'sentence_2_fading') {
        transitionToPhase('sentence_3_learning');
      } else if (phase === 'sentence_3_fading') {
        transitionToPhase('beat_combining');
      }
    }, 2000);
  };

  const showBeatCelebration = async () => {
    setCelebrationMessage(t('beat_practice.beat_complete'));
    setShowCelebration(true);
    
    // Mark beat as mastered
    if (currentBeat) {
      await supabase
        .from('practice_beats')
        .update({ is_mastered: true })
        .eq('id', currentBeat.id);
    }
    
    setTimeout(() => {
      setShowCelebration(false);
      
      // Move to next beat or complete
      if (currentBeatIndex < beats.length - 1) {
        setCurrentBeatIndex(prev => prev + 1);
        transitionToPhase('sentence_1_learning');
      } else {
        onComplete?.();
      }
    }, 2500);
  };

  // Start recording using Web Speech API
  const startRecording = async () => {
    if (recognitionRef.current) return;

    resetForNextRep();
    
    try {
      // Check for Web Speech API support
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
        transcriptRef.current = combined;

        const lastIsFinal = event.results.length
          ? event.results[event.results.length - 1].isFinal
          : false;

        processTranscriptionRef.current(combined, lastIsFinal);
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
        // Restart if still recording
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Recognition already started');
          }
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
      setIsRecording(true);
      lastWordTimeRef.current = Date.now();
      
      // Start hesitation checking
      hesitationTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastWordTimeRef.current;
        const idx = currentWordIndexRef.current;
        if (elapsed > 3000 && idx < wordsLengthRef.current) {
          // Only mark as hesitated if the word is HIDDEN
          if (hiddenWordIndicesRef.current.has(idx)) {
            setHesitatedIndices((prev) => new Set([...prev, idx]));
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

  // Stop recording
  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (hesitationTimerRef.current) {
      clearInterval(hesitationTimerRef.current);
      hesitationTimerRef.current = null;
    }
    
    setIsRecording(false);
    
    // Process final state
    checkCompletion(spokenIndices, failedWordIndices);
  };

  // Auto-start listening (no button press)
  useEffect(() => {
    if (loading) return;
    if (!currentBeat) return;
    if (showCelebration) return;
    if (recognitionRef.current) return;

    startRecording();
  }, [loading, currentBeat?.id, showCelebration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (hesitationTimerRef.current) {
        clearInterval(hesitationTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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

  return (
    <div className="flex flex-col h-full">
      {/* Progress header */}
      <BeatProgress
        currentBeat={currentBeatIndex}
        totalBeats={beats.length}
        currentSentence={getCurrentSentenceNumber()}
        phase={getPhaseType()}
        repetitionCount={repetitionCount}
        wordsRemaining={words.length - hiddenWordIndices.size}
      />

      {/* Main content area */}
      <Card className="flex-1 relative overflow-hidden">
        <CardContent className="flex items-center justify-center min-h-[300px] p-4">
          <AnimatePresence mode="wait">
            {showCelebration ? (
              <motion.div
                key="celebration"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <Sparkles className="h-16 w-16 text-primary animate-pulse" />
                <p className="text-2xl font-bold text-primary">{celebrationMessage}</p>
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
                    // Reveal word on tap if hidden
                    if (hiddenWordIndices.has(idx)) {
                      setHiddenWordIndices(prev => {
                        const next = new Set(prev);
                        next.delete(idx);
                        return next;
                      });
                    }
                  }}
                />
                
                {/* Progress check - fills green as more words are hidden & mastered */}
                {phase.includes('fading') || phase === 'beat_combining' ? (
                  <div className="mt-6 flex items-center gap-3">
                    <div className="relative w-10 h-10">
                      {/* Background circle */}
                      <svg className="w-10 h-10 -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-muted/30"
                        />
                        {/* Progress arc */}
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          className="text-green-500 transition-all duration-300"
                          strokeDasharray={`${(hiddenWordIndices.size / Math.max(words.length, 1)) * 100.5} 100.5`}
                        />
                      </svg>
                      {/* Center check icon */}
                      <CheckCircle2 
                        className={cn(
                          "absolute inset-0 m-auto w-5 h-5 transition-colors duration-300",
                          hiddenWordIndices.size === words.length ? "text-green-500" : "text-muted-foreground/40"
                        )}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {hiddenWordIndices.size}/{words.length} words mastered
                    </span>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-6">
        <Button
          variant="outline"
          size="icon"
          onClick={onExit}
          className="rounded-full"
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default BeatPracticeView;
