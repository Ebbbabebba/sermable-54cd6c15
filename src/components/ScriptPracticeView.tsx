import { useState, useRef, useEffect } from "react";
import { requestMicrophoneAccess } from "@/utils/microphone";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Square, RotateCcw, ChevronRight, 
  Loader2, BookOpen, KeyRound, Mic, Merge, Split,
  CheckCircle2, XCircle, AlertCircle, Eye, EyeOff, Trophy
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { stripStageDirections } from "@/utils/stageDirections";

interface Beat {
  beat_index: number;
  text: string;
  reference_word: string;
}

interface RetellingResult {
  score: number;
  content_coverage: number;
  order_accuracy: number;
  key_words_hit: string[];
  key_words_missed: string[];
  feedback: string;
  transcript?: string;
}

interface BeatSessionResult {
  beatStart: number;
  beatEnd: number;
  score: number;
  content_coverage: number;
  order_accuracy: number;
}

type Phase = 'loading' | 'reading' | 'reference' | 'recording' | 'analyzing' | 'results' | 'summary';

interface SpeechRecognitionAlternativeLike {
  transcript?: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const getRecognitionLanguage = (lang: string): string => {
  if (!lang) return "en-US";
  if (lang.includes("-") || lang.includes("_")) return lang.replace("_", "-");
  const map: Record<string, string> = {
    en: "en-US", sv: "sv-SE", de: "de-DE", fr: "fr-FR",
    es: "es-ES", it: "it-IT", pt: "pt-PT",
  };
  return map[lang.toLowerCase()] || `${lang}-${lang.toUpperCase()}`;
};

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
};

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback;

const normalizeKeyword = (text: string): string =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "");

const getKeywordDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
};

const keywordMatches = (spoken: string, keyword: string): boolean => {
  const a = normalizeKeyword(spoken);
  const b = normalizeKeyword(keyword);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.length <= 3) return false;
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) >= Math.max(4, b.length - 2);
  if (a[0] !== b[0]) return false;
  const similarity = 1 - getKeywordDistance(a, b) / Math.max(a.length, b.length);
  return similarity >= 0.76;
};

const getCleanWordCount = (text: string): number =>
  stripStageDirections(text).split(/\s+/).map(normalizeKeyword).filter(Boolean).length;

interface ScriptPracticeViewProps {
  speechId: string;
  speechTitle: string;
  speechText: string;
  speechLanguage: string;
  onBack: () => void;
}

const ScriptPracticeView = ({
  speechId,
  speechTitle,
  speechText,
  speechLanguage,
  onBack,
}: ScriptPracticeViewProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Beat data
  const [beats, setBeats] = useState<Beat[]>([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [result, setResult] = useState<RetellingResult | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string>("");

  // Session tracking
  const [sessionResults, setSessionResults] = useState<BeatSessionResult[]>([]);
  const sessionStartTime = useRef<number>(Date.now());

  // Aggregation
  const [aggregatedRange, setAggregatedRange] = useState<[number, number]>([0, 0]);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [liveBeatIndex, setLiveBeatIndex] = useState(0);
  const [coveredBeatIndexes, setCoveredBeatIndexes] = useState<Set<number>>(new Set());
  const [liveTranscript, setLiveTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isRecordingRef = useRef(false);
  const liveBeatIndexRef = useRef(0);
  const recordingRangeRef = useRef<[number, number]>([0, 0]);
  const coveredBeatIndexesRef = useRef<Set<number>>(new Set());
  const lastInterimRef = useRef("");

  // Load beats on mount - try cache first
  useEffect(() => {
    loadOrExtractBeats();
  }, []);

  const loadOrExtractBeats = async () => {
    setPhase('loading');
    try {
      // Try loading cached beats first
      const { data: cachedBeats, error: cacheError } = await supabase
        .from('script_beats')
        .select('*')
        .eq('speech_id', speechId)
        .order('beat_index', { ascending: true });

      if (!cacheError && cachedBeats && cachedBeats.length > 0) {
        const mapped: Beat[] = cachedBeats.map(b => ({
          beat_index: b.beat_index,
          text: b.text,
          reference_word: b.reference_word,
        }));
        setBeats(mapped);
        setAggregatedRange([0, 0]);
        setPhase('reading');
        return;
      }

      // Extract fresh beats
      const { data, error } = await supabase.functions.invoke('extract-reference-words', {
        body: { text: speechText, language: speechLanguage }
      });

      if (error) throw error;
      if (!data?.beats || data.beats.length === 0) throw new Error("No beats extracted");

      setBeats(data.beats);
      setAggregatedRange([0, 0]);
      setPhase('reading');

      // Cache beats in background
      const beatsToInsert = data.beats.map((b: Beat) => ({
        speech_id: speechId,
        beat_index: b.beat_index,
        text: b.text,
        reference_word: b.reference_word,
      }));

      await supabase.from('script_beats').delete().eq('speech_id', speechId);
      await supabase.from('script_beats').insert(beatsToInsert);
    } catch (err: unknown) {
      console.error("Error extracting beats:", err);
      toast({
        variant: "destructive",
        title: t('common.error', 'Error'),
        description: getErrorMessage(err, "Failed to process text"),
      });
    }
  };

  const currentBeats = beats.slice(aggregatedRange[0], aggregatedRange[1] + 1);
  const currentText = currentBeats.map(b => b.text).join(' ');
  const currentReferenceWords = currentBeats.map(b => b.reference_word);
  const totalBeats = beats.length;
  const progressPercent = totalBeats > 0 ? ((aggregatedRange[1] + 1) / totalBeats) * 100 : 0;
  const activeBeat = beats[liveBeatIndex];
  const nextBeat = liveBeatIndex + 1 < totalBeats ? beats[liveBeatIndex + 1] : null;
  const coveredCount = coveredBeatIndexes.size;

  const handleContinueToReference = () => {
    setPhase('reference');
  };

  const moveLiveCursor = (beatIndex: number) => {
    if (totalBeats === 0) return;
    const next = Math.max(0, Math.min(beatIndex, totalBeats - 1));
    liveBeatIndexRef.current = next;
    setLiveBeatIndex(next);
    recordingRangeRef.current = [recordingRangeRef.current[0], Math.max(recordingRangeRef.current[1], next)];
    setAggregatedRange([recordingRangeRef.current[0], Math.max(recordingRangeRef.current[1], next)]);
  };

  const markBeatCovered = (beatIndex: number) => {
    if (beatIndex < 0 || beatIndex >= totalBeats) return;
    if (!coveredBeatIndexesRef.current.has(beatIndex)) {
      const nextCovered = new Set(coveredBeatIndexesRef.current);
      nextCovered.add(beatIndex);
      coveredBeatIndexesRef.current = nextCovered;
      setCoveredBeatIndexes(nextCovered);
    }
    if (beatIndex >= liveBeatIndexRef.current && beatIndex < totalBeats - 1) {
      moveLiveCursor(beatIndex + 1);
    } else {
      moveLiveCursor(beatIndex);
    }
  };

  const processLiveWords = (spoken: string) => {
    const spokenWords = spoken.split(/\s+/).filter(Boolean);
    if (spokenWords.length === 0 || beats.length === 0) return;

    for (const spokenWord of spokenWords) {
      const current = liveBeatIndexRef.current;
      let matchedBeat = -1;
      for (let offset = 0; offset <= 3 && current + offset < beats.length; offset++) {
        if (keywordMatches(spokenWord, beats[current + offset].reference_word)) {
          matchedBeat = current + offset;
          break;
        }
      }
      if (matchedBeat !== -1) markBeatCovered(matchedBeat);
    }
  };

  const stopLiveKeywordRecognition = () => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.onend = null; speechRecognitionRef.current.stop(); } catch { speechRecognitionRef.current = null; }
      speechRecognitionRef.current = null;
    }
    lastInterimRef.current = "";
  };

  const startLiveKeywordRecognition = () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) return;

    stopLiveKeywordRecognition();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getRecognitionLanguage(speechLanguage);
    recognition.maxAlternatives = 3;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${transcript} `;
        else interimText += transcript;
      }

      const visibleTranscript = `${finalText || ""}${interimText || ""}`.trim();
      if (visibleTranscript) setLiveTranscript(visibleTranscript);

      if (interimText && interimText !== lastInterimRef.current) {
        const prev = lastInterimRef.current.trim().split(/\s+/).filter(Boolean);
        const current = interimText.trim().split(/\s+/).filter(Boolean);
        if (current.length > prev.length) processLiveWords(current.slice(prev.length).join(" "));
        lastInterimRef.current = interimText;
      }

      if (finalText) {
        processLiveWords(finalText);
        lastInterimRef.current = "";
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Script mode speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current && speechRecognitionRef.current === recognition) {
        setTimeout(() => {
          try { recognition.start(); } catch { speechRecognitionRef.current = null; }
        }, 250);
      }
    };

    speechRecognitionRef.current = recognition;
    try { recognition.start(); } catch { speechRecognitionRef.current = null; }
  };

  const handleStartRecording = async () => {
    try {
      const startIndex = aggregatedRange[0];
      recordingRangeRef.current = [startIndex, aggregatedRange[1]];
      liveBeatIndexRef.current = startIndex;
      coveredBeatIndexesRef.current = new Set();
      setLiveBeatIndex(startIndex);
      setCoveredBeatIndexes(new Set());
      setLiveTranscript("");
      lastInterimRef.current = "";

      const stream = await requestMicrophoneAccess({
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      let mimeType = 'audio/webm';
      if (isIOS && MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        isRecordingRef.current = false;
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        handleRecordingDone(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(200);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);
      setPhase('recording');
      startLiveKeywordRecognition();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Microphone error",
        description: "Could not access microphone.",
      });
    }
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;
    stopLiveKeywordRecognition();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      stopLiveKeywordRecognition();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleRecordingDone = async (audioBlob: Blob) => {
    setPhase('analyzing');
    const [analysisStart, analysisEnd] = recordingRangeRef.current;
    const analysisText = beats.slice(analysisStart, analysisEnd + 1).map(b => b.text).join(' ') || currentText;

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('whisper-stream', {
            body: { audio: base64Audio, language: speechLanguage }
          });
          if (transcriptError) throw transcriptError;

          const transcript = transcriptData.transcript || '';
          setLastTranscript(transcript);

          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-retelling', {
            body: {
              originalText: analysisText,
              transcript,
              language: speechLanguage,
            }
          });
          if (analysisError) throw analysisError;

          const originalWordCount = getCleanWordCount(analysisText);
          const transcriptWordCount = getCleanWordCount(transcript);
          const spokenRatio = originalWordCount > 0 ? transcriptWordCount / originalWordCount : 0;
          const tooLittleSpeech = transcriptWordCount < Math.max(3, Math.ceil(originalWordCount * 0.18));
          const cappedScore = tooLittleSpeech ? Math.min(analysisData.score ?? 0, spokenRatio <= 0.05 ? 15 : 40) : analysisData.score;
          const cappedCoverage = tooLittleSpeech ? Math.min(analysisData.content_coverage ?? 0, spokenRatio <= 0.05 ? 10 : 35) : analysisData.content_coverage;
          const resultWithTranscript = {
            ...analysisData,
            score: cappedScore,
            content_coverage: cappedCoverage,
            feedback: tooLittleSpeech
              ? t('script.tooLittleSpeechFeedback', 'Too little speech was recognized to count this as an excellent run.')
              : analysisData.feedback,
            transcript,
          };
          setResult(resultWithTranscript);
          setPhase('results');

          // Save session to database
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          if (user) {
            await supabase.from('script_sessions').insert({
              speech_id: speechId,
              user_id: user.id,
              beat_start: analysisStart,
              beat_end: analysisEnd,
              score: resultWithTranscript.score,
              content_coverage: resultWithTranscript.content_coverage,
              order_accuracy: analysisData.order_accuracy,
              transcript,
            });
          }

          // Track for summary
          setSessionResults(prev => [...prev, {
            beatStart: analysisStart,
            beatEnd: analysisEnd,
            score: resultWithTranscript.score,
            content_coverage: resultWithTranscript.content_coverage,
            order_accuracy: analysisData.order_accuracy,
          }]);
        } catch (err: unknown) {
          console.error("Analysis error:", err);
          toast({ variant: "destructive", title: "Analysis failed", description: getErrorMessage(err, "Could not analyze recording") });
          setPhase('reference');
        }
      };
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Error", description: getErrorMessage(err, "Could not process recording") });
      setPhase('reference');
    }
  };

  const handleRepeat = () => {
    setResult(null);
    setShowOriginal(false);
    setLastTranscript("");
    setPhase('reading');
  };

  const handleNextBeat = () => {
    const nextIndex = aggregatedRange[1] + 1;
    if (nextIndex < totalBeats) {
      setAggregatedRange([nextIndex, nextIndex]);
      setCurrentBeatIndex(nextIndex);
      setResult(null);
      setShowOriginal(false);
      setLastTranscript("");
      setPhase('reading');
    } else {
      // All beats done — show summary
      setPhase('summary');
    }
  };

  const handleAggregate = () => {
    const newEnd = Math.min(aggregatedRange[1] + 1, totalBeats - 1);
    if (newEnd > aggregatedRange[1]) {
      setAggregatedRange([aggregatedRange[0], newEnd]);
      setResult(null);
      setShowOriginal(false);
      setPhase('reading');
    }
  };

  const handleDisaggregate = () => {
    if (aggregatedRange[1] > aggregatedRange[0]) {
      setAggregatedRange([aggregatedRange[0], aggregatedRange[0]]);
      setResult(null);
      setShowOriginal(false);
      setPhase('reading');
    }
  };

  const canAggregate = aggregatedRange[1] < totalBeats - 1;
  const canDisaggregate = aggregatedRange[1] > aggregatedRange[0];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    if (score >= 60) return <AlertCircle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  // Summary calculations
  const overallScore = sessionResults.length > 0
    ? Math.round(sessionResults.reduce((sum, r) => sum + r.score, 0) / sessionResults.length)
    : 0;
  const totalTimeMinutes = Math.round((Date.now() - sessionStartTime.current) / 60000);

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t('script.analyzing', 'Analyzing your text...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur-sm" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium truncate max-w-[200px]">{speechTitle}</p>
          <p className="text-xs text-muted-foreground">
            {phase !== 'summary' && t('script.beatOf', 'Beat {{current}} of {{total}}', {
              current: aggregatedRange[1] + 1,
              total: totalBeats,
            })}
            {canDisaggregate && ` (${currentBeats.length} ${t('script.combined', 'combined')})`}
          </p>
        </div>
        <div className="w-20" />
      </div>

      {/* Progress */}
      {phase !== 'summary' && <Progress value={progressPercent} className="h-1 rounded-none" />}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* PHASE: Reading */}
            {phase === 'reading' && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center gap-3 text-primary">
                  <BookOpen className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">{t('script.readCarefully', 'Read carefully')}</h2>
                </div>

                <Card className="border-2 border-primary/20">
                  <CardContent className="p-6">
                    <p className="text-xl leading-relaxed font-medium">
                      {currentText}
                    </p>
                  </CardContent>
                </Card>

                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleContinueToReference}
                >
                  {t('script.ready', "I've read it")}
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </motion.div>
            )}

            {/* PHASE: Reference word */}
            {phase === 'reference' && (
              <motion.div
                key="reference"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-8 text-center"
              >
                <div className="flex items-center justify-center gap-3 text-primary">
                  <KeyRound className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">{t('script.referenceWord', 'Reference word')}</h2>
                </div>

                <div className="space-y-4">
                  {currentReferenceWords.map((word, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.2 }}
                    >
                      <span className="inline-block text-4xl md:text-5xl font-bold text-primary px-6 py-3 rounded-xl bg-primary/10 border-2 border-primary/20">
                        {word}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <p className="text-muted-foreground">
                  {t('script.retellPrompt', 'Now try to retell the text in your own words')}
                </p>

                <Button
                  size="lg"
                  className="w-full gap-3"
                  onClick={handleStartRecording}
                >
                  <Mic className="h-5 w-5" />
                  {t('script.startRecording', 'Start recording')}
                </Button>
              </motion.div>
            )}

            {/* PHASE: Recording */}
            {phase === 'recording' && (
              <motion.div
                key="recording"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 text-center"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-center gap-2">
                    {beats.map((beat, beatPosition) => (
                      <span
                        key={`${beat.beat_index}-${beatPosition}`}
                        className={`h-2.5 rounded-full transition-all ${
                          beatPosition === liveBeatIndex
                            ? 'w-8 bg-primary'
                            : coveredBeatIndexes.has(beatPosition)
                              ? 'w-2.5 bg-primary/45'
                              : 'w-2.5 bg-muted'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {t('script.currentKeyword', 'Current keyword')}
                    </p>
                    <motion.div
                      key={activeBeat?.beat_index ?? 'none'}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex min-h-24 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 px-8 py-5"
                    >
                      <span className="text-5xl md:text-6xl font-bold text-primary">
                        {activeBeat?.reference_word || currentReferenceWords[0]}
                      </span>
                    </motion.div>
                    {nextBeat && (
                      <p className="text-sm text-muted-foreground">
                        {t('script.nextKeyword', 'Next')}: {nextBeat.reference_word}
                      </p>
                    )}
                  </div>
                </div>

                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-destructive/10 border-4 border-destructive flex items-center justify-center mx-auto"
                >
                  <Mic className="h-10 w-10 text-destructive" />
                </motion.div>

                <div className="space-y-2">
                  <p className="text-muted-foreground">
                    {t('script.speakingNowLive', 'Speak naturally — keywords advance as you mention them.')}
                  </p>
                  {liveTranscript && (
                    <p className="mx-auto max-w-xl truncate text-xs italic text-muted-foreground/80">
                      “{liveTranscript}”
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('script.keywordsCovered', '{{covered}} of {{total}} keywords', {
                      covered: coveredCount,
                      total: totalBeats,
                    })}
                  </p>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <Button
                    size="lg"
                    variant="destructive"
                    className="gap-3"
                    onClick={handleStopRecording}
                  >
                    <Square className="h-5 w-5" />
                    {t('script.stopRecording', 'Done speaking')}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => moveLiveCursor(liveBeatIndex + 1)}
                    aria-label={t('script.nextKeyword', 'Next')}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* PHASE: Analyzing */}
            {phase === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4"
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">{t('script.analyzing_retelling', 'Analyzing your retelling...')}</p>
              </motion.div>
            )}

            {/* PHASE: Results */}
            {phase === 'results' && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Score header */}
                <div className="text-center space-y-3">
                  {getScoreIcon(result.score)}
                  <div>
                    <span className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                      {result.score}%
                    </span>
                    <p className="text-muted-foreground mt-1">{result.feedback}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t('script.content', 'Content')}</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.content_coverage)}`}>
                        {result.content_coverage}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">{t('script.order', 'Order')}</p>
                      <p className={`text-2xl font-bold ${getScoreColor(result.order_accuracy)}`}>
                        {result.order_accuracy}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Transcript comparison */}
                {lastTranscript && (
                  <Card className="border border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t('script.yourRetelling', 'What you said')}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowOriginal(!showOriginal)}
                          className="gap-1.5 text-xs"
                        >
                          {showOriginal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          {showOriginal
                            ? t('script.hideOriginal', 'Hide original')
                            : t('script.showOriginal', 'Show original')}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        "{lastTranscript}"
                      </p>
                      {showOriginal && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-3 border-t border-border"
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-1">{t('script.original', 'Original')}</p>
                          <p className="text-sm leading-relaxed">{currentText}</p>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Key words */}
                {result.key_words_hit.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      {t('script.wordsHit', 'Words you nailed')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.key_words_hit.map((w, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-md bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.key_words_missed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" />
                      {t('script.wordsMissed', 'Words you missed')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.key_words_missed.map((w, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-md bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button variant="outline" onClick={handleRepeat} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t('script.repeat', 'Repeat')}
                  </Button>
                  <Button onClick={handleNextBeat} className="gap-2">
                    <ChevronRight className="h-4 w-4" />
                    {aggregatedRange[1] + 1 < totalBeats
                      ? t('script.nextBeat', 'Next beat')
                      : t('script.finish', 'Finish')}
                  </Button>
                </div>

                {/* Aggregate / Disaggregate with tooltips */}
                <TooltipProvider>
                  <div className="flex gap-3 pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAggregate}
                          disabled={!canAggregate}
                          className="flex-1 gap-2 text-xs"
                        >
                          <Merge className="h-4 w-4" />
                          {t('script.aggregate', 'Add next beat')}
                          {canAggregate && (
                            <span className="text-muted-foreground">
                              ({aggregatedRange[0] + 1}–{aggregatedRange[1] + 2})
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('script.aggregateTooltip', 'Combine with next beat for a bigger challenge')}</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleDisaggregate}
                          disabled={!canDisaggregate}
                          className="flex-1 gap-2 text-xs"
                        >
                          <Split className="h-4 w-4" />
                          {t('script.disaggregate', 'Single beat only')}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('script.disaggregateTooltip', 'Go back to practicing one beat at a time')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </motion.div>
            )}

            {/* PHASE: Session Summary */}
            {phase === 'summary' && (
              <motion.div
                key="summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                <div className="text-center space-y-4">
                  <Trophy className="h-12 w-12 text-primary mx-auto" />
                  <h2 className="text-2xl font-bold">{t('script.sessionComplete', 'Session Complete!')}</h2>
                  <div>
                    <span className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                      {overallScore}%
                    </span>
                    <p className="text-muted-foreground mt-1">
                      {t('script.averageScore', 'Average score')}
                    </p>
                  </div>
                  {totalTimeMinutes > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('script.timeSpent', '{{minutes}} min', { minutes: totalTimeMinutes })}
                    </p>
                  )}
                </div>

                {/* Per-beat breakdown */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t('script.perBeat', 'Per beat')}</p>
                  {sessionResults.map((sr, i) => (
                    <Card key={i}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <span className="text-sm">
                          {sr.beatStart === sr.beatEnd
                            ? `Beat ${sr.beatStart + 1}`
                            : `Beats ${sr.beatStart + 1}–${sr.beatEnd + 1}`}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {sr.content_coverage}% content · {sr.order_accuracy}% order
                          </span>
                          <span className={`text-sm font-bold ${getScoreColor(sr.score)}`}>
                            {sr.score}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button size="lg" className="w-full" onClick={onBack}>
                  {t('common.done', 'Done')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ScriptPracticeView;
