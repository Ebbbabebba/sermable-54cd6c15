import { useState, useRef, useEffect, useCallback } from "react";
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
import { stripPropCueMarkers } from "@/utils/propCues";

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
  if (b.length <= 2) return false;
  // Substring (handles inflections / compound words)
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) >= 3;
  // Shared stem prefix — catches inflected forms (presenterar vs presentation)
  const stemLen = Math.min(a.length, b.length, b.length >= 6 ? 5 : 4);
  if (stemLen >= 4 && a.slice(0, stemLen) === b.slice(0, stemLen)) return true;
  const similarity = 1 - getKeywordDistance(a, b) / Math.max(a.length, b.length);
  // Loosen threshold; require first letter for short words only
  if (b.length <= 5) {
    if (a[0] !== b[0]) return false;
    return similarity >= 0.6;
  }
  return similarity >= 0.55;
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
  const { t, i18n } = useTranslation();
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

  const loadOrExtractBeats = useCallback(async () => {
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
          text: stripPropCueMarkers(b.text),
          reference_word: stripPropCueMarkers(b.reference_word),
        }));
        setBeats(mapped);
        setAggregatedRange([0, 0]);
        setPhase('reading');
        return;
      }

      // Extract fresh beats
      const { data, error } = await supabase.functions.invoke('extract-reference-words', {
        body: { text: stripPropCueMarkers(speechText), language: speechLanguage }
      });

      if (error) throw error;
      if (!data?.beats || data.beats.length === 0) throw new Error(t('script.noBeatsExtracted'));

      setBeats(data.beats.map((beat: Beat) => ({
        ...beat,
        text: stripPropCueMarkers(beat.text),
        reference_word: stripPropCueMarkers(beat.reference_word),
      })));
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
        description: getErrorMessage(err, t('common.failedToProcess')),
      });
    }
  }, [speechId, speechText, speechLanguage, t, toast]);

  // Load beats on mount - try cache first
  useEffect(() => {
    loadOrExtractBeats();
  }, [loadOrExtractBeats]);

  const currentBeats = beats.slice(aggregatedRange[0], aggregatedRange[1] + 1);
  const currentText = currentBeats.map(b => stripPropCueMarkers(b.text)).join(' ');
  const currentReferenceWords = currentBeats.map(b => stripPropCueMarkers(b.reference_word));
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
      // Wider lookahead — speakers often skip or compress beats
      for (let offset = 0; offset <= 6 && current + offset < beats.length; offset++) {
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
        else interimText += `${transcript} `;
      }

      const visibleTranscript = `${finalText}${interimText}`.trim();
      if (visibleTranscript) setLiveTranscript(visibleTranscript);

      // Process final text immediately
      if (finalText.trim()) {
        processLiveWords(finalText);
      }

      // For interim: re-scan the entire interim segment every update.
      // markBeatCovered is idempotent so re-processing already-matched words is safe.
      if (interimText.trim() && interimText !== lastInterimRef.current) {
        processLiveWords(interimText);
        lastInterimRef.current = interimText;
      }

      if (finalText) {
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
        title: t('common.micError'),
        description: t('common.couldNotAccessMic'),
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
    const analysisText = stripPropCueMarkers(
      beats.slice(analysisStart, analysisEnd + 1).map(b => b.text).join(' ') || currentText,
    );

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
              feedbackLanguage: i18n.language || speechLanguage,
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
          toast({ variant: "destructive", title: t('common.analysisFailed'), description: getErrorMessage(err, t('common.couldNotAnalyze')) });
          setPhase('reference');
        }
      };
    } catch (err: unknown) {
      toast({ variant: "destructive", title: t('common.error'), description: getErrorMessage(err, t('common.couldNotProcess')) });
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
    if (score >= 80) return 's-ud';
    if (score >= 60) return 's-vk';
    return 's-v1';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle2 className="s-g2 s-xw s-ud" />;
    if (score >= 60) return <AlertCircle className="s-g2 s-xw s-vk" />;
    return <XCircle className="s-g2 s-xw s-v1" />;
  };

  // Summary calculations
  const overallScore = sessionResults.length > 0
    ? Math.round(sessionResults.reduce((sum, r) => sum + r.score, 0) / sessionResults.length)
    : 0;
  const totalTimeMinutes = Math.round((Date.now() - sessionStartTime.current) / 60000);

  // Loading state
  if (phase === 'loading') {
    return (
      <div className="s-l6 s-3v s-c5 s-ib s-ig">
        <div className="s-u0 s-t1">
          <Loader2 className="s-fn s-xf s-32 s-uw s-m9" />
          <p className="s-ul">{t('script.analyzing', 'Analyzing your text...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="s-l6 s-3v s-c5 s-c7">
      {/* Header */}
      <div className="s-t7 s-w1 s-ye s-c5 s-ib s-if s-6v s-6x s-43 s-mw s-3h" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <Button variant="ghost" size="sm" onClick={onBack} className="s-dn">
          <ArrowLeft className="s-fz s-xt" />
          {t('common.back', 'Back')}
        </Button>
        <div className="s-u0">
          <p className="s-v9 s-d0 truncate s-ji">{speechTitle}</p>
          <p className="s-vj s-ul">
            {phase !== 'summary' && t('script.beatOf', 'Beat {{current}} of {{total}}', {
              current: aggregatedRange[1] + 1,
              total: totalBeats,
            })}
            {canDisaggregate && ` (${currentBeats.length} ${t('script.combined', 'combined')})`}
          </p>
        </div>
        <div className="s-xn" />
      </div>

      {/* Progress */}
      {phase !== 'summary' && <Progress value={progressPercent} className="s-fl s-qj" />}

      {/* Main content */}
      <div className="s-c6 s-c5 s-ib s-ig s-my">
        <div className="s-y7 s-jc">
          <AnimatePresence mode="wait">
            {/* PHASE: Reading */}
            {phase === 'reading' && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="s-t4"
              >
                <div className="s-c5 s-ib s-dp s-uw">
                  <BookOpen className="s-g1 s-xv" />
                  <h2 className="s-uk s-d3">{t('script.readCarefully', 'Read carefully')}</h2>
                </div>

                <Card className="s-6n s-7p">
                  <CardContent className="s-my">
                    <p className="s-vi s-ip s-d0">
                      {currentText}
                    </p>
                  </CardContent>
                </Card>

                <Button
                  size="lg"
                  className="s-y7"
                  onClick={handleContinueToReference}
                >
                  {t('script.ready', "I've read it")}
                  <ChevronRight className="s-g1 s-xv s-lk" />
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
                className="s-t4 s-u0"
              >
                <div className="s-c5 s-ib s-ig s-dp s-uw">
                  <KeyRound className="s-g1 s-xv" />
                  <h2 className="s-uk s-d3">{t('script.referenceWord', 'Reference word')}</h2>
                </div>

                <div className="s-t1">
                  {currentReferenceWords.map((word, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.2 }}
                    >
                      <span className="s-i3 s-tb s-kl s-cx s-uw s-ou s-p6 s-qo s-5e s-6n s-7p">
                        {word}
                      </span>
                    </motion.div>
                  ))}
                </div>

                <p className="s-ul">
                  {t('script.retellPrompt', 'Now try to retell the text in your own words')}
                </p>

                <Button
                  size="lg"
                  className="s-y7 s-dp"
                  onClick={handleStartRecording}
                >
                  <Mic className="s-g1 s-xv" />
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
                className="s-t4 s-u0"
              >
                <div className="s-t2">
                  <div className="s-c5 s-ib s-ig s-dn s-cb">
                    {beats.map((beat, beatPosition) => (
                      <button
                        key={`${beat.beat_index}-${beatPosition}`}
                        type="button"
                        onClick={() => moveLiveCursor(beatPosition)}
                        aria-label={`${t('script.nextKeyword', 'Next')}: ${beat.reference_word}`}
                        className={`s-ft s-qe s-wr s-8m s-ho ${
                          beatPosition === liveBeatIndex
                            ? 's-y0 s-5c'
                            : coveredBeatIndexes.has(beatPosition)
                              ? 's-xl s-5i'
                              : 's-xl s-50'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="s-t0">
                    <p className="s-vj s-d0 s-x1 s-ul">
                      {t('script.currentKeyword', 'Current keyword')}
                    </p>
                    <motion.button
                      type="button"
                      key={activeBeat?.beat_index ?? 'none'}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => moveLiveCursor(liveBeatIndex + 1)}
                      className="s-i4 s-kv s-ib s-ig s-qh s-6l s-7q s-5e s-ov s-p8 s-wl s-h5 s-29 s-8m"
                      aria-label={t('script.tapToAdvance', 'Tap to advance')}
                    >
                      <span className="s-tc s-km s-cx s-uw">
                        {activeBeat?.reference_word || currentReferenceWords[0]}
                      </span>
                    </motion.button>
                    {nextBeat && (
                      <button
                        type="button"
                        onClick={() => moveLiveCursor(liveBeatIndex + 1)}
                        className="s-v9 s-ul s-hv s-wl"
                      >
                        {t('script.nextKeyword', 'Next')}: {nextBeat.reference_word} →
                      </button>
                    )}
                  </div>
                </div>

                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="s-xo s-fv s-qe s-4i s-6o s-75 s-c5 s-ib s-ig s-m9"
                >
                  <Mic className="s-fn s-xf s-u2" />
                </motion.div>

                <div className="s-sy">
                  <p className="s-ul">
                    {t('script.speakingNowLive', 'Speak naturally — keywords advance as you mention them.')}
                  </p>
                  {liveTranscript && (
                    <p className="s-m9 s-jt truncate s-vj italic s-uq">
                      “{liveTranscript}”
                    </p>
                  )}
                  <p className="s-vj s-ul">
                    {t('script.keywordsCovered', '{{covered}} of {{total}} keywords', {
                      covered: coveredCount,
                      total: totalBeats,
                    })}
                  </p>
                </div>

                <div className="s-e0 s-e4 s-dp">
                  <Button
                    size="lg"
                    variant="destructive"
                    className="s-dp"
                    onClick={handleStopRecording}
                  >
                    <Square className="s-g1 s-xv" />
                    {t('script.stopRecording', 'Done speaking')}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => moveLiveCursor(liveBeatIndex + 1)}
                    aria-label={t('script.nextKeyword', 'Next')}
                  >
                    <ChevronRight className="s-g1 s-xv" />
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
                className="s-u0 s-t1"
              >
                <Loader2 className="s-fn s-xf s-32 s-uw s-m9" />
                <p className="s-ul">{t('script.analyzing_retelling', 'Analyzing your retelling...')}</p>
              </motion.div>
            )}

            {/* PHASE: Results */}
            {phase === 'results' && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="s-t3"
              >
                {/* Score header */}
                <div className="s-u0 s-t0">
                  {getScoreIcon(result.score)}
                  <div>
                    <span className={`s-tc s-cx ${getScoreColor(result.score)}`}>
                      {result.score}%
                    </span>
                    <p className="s-ul s-lt">{result.feedback}</p>
                  </div>
                </div>

                {/* Metrics */}
                <div className="s-e0 s-e2 s-dp">
                  <Card>
                    <CardContent className="s-mw s-u0">
                      <p className="s-vj s-ul s-jw">{t('script.content', 'Content')}</p>
                      <p className={`s-t9 s-cx ${getScoreColor(result.content_coverage)}`}>
                        {result.content_coverage}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="s-mw s-u0">
                      <p className="s-vj s-ul s-jw">{t('script.order', 'Order')}</p>
                      <p className={`s-t9 s-cx ${getScoreColor(result.order_accuracy)}`}>
                        {result.order_accuracy}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Transcript comparison */}
                {lastTranscript && (
                  <Card className="s-6l s-6x">
                    <CardContent className="s-mw s-t0">
                      <div className="s-c5 s-ib s-if">
                        <p className="s-v9 s-d0">{t('script.yourRetelling', 'What you said')}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowOriginal(!showOriginal)}
                          className="s-dm s-vj"
                        >
                          {showOriginal ? <EyeOff className="s-fx s-xq" /> : <Eye className="s-fx s-xq" />}
                          {showOriginal
                            ? t('script.hideOriginal', 'Hide original')
                            : t('script.showOriginal', 'Show original')}
                        </Button>
                      </div>
                      <p className="s-v9 s-ul italic s-ip">
                        "{lastTranscript}"
                      </p>
                      {showOriginal && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="s-oc s-82 s-6x"
                        >
                          <p className="s-vj s-d0 s-ul s-jw">{t('script.original', 'Original')}</p>
                          <p className="s-v9 s-ip">{currentText}</p>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Key words */}
                {result.key_words_hit.length > 0 && (
                  <div className="s-sy">
                    <p className="s-v9 s-d0 s-ue s-8s s-c5 s-ib s-dm">
                      <CheckCircle2 className="s-fz s-xt" />
                      {t('script.wordsHit', 'Words you nailed')}
                    </p>
                    <div className="s-c5 s-cb s-dm">
                      {result.key_words_hit.map((w, i) => (
                        <span key={i} className="s-op s-oy s-vj s-qi s-4w s-uf s-8r s-6l s-7d">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.key_words_missed.length > 0 && (
                  <div className="s-sy">
                    <p className="s-v9 s-d0 s-v2 s-8v s-c5 s-ib s-dm">
                      <XCircle className="s-fz s-xt" />
                      {t('script.wordsMissed', 'Words you missed')}
                    </p>
                    <div className="s-c5 s-cb s-dm">
                      {result.key_words_missed.map((w, i) => (
                        <span key={i} className="s-op s-oy s-vj s-qi s-5o s-v3 s-8u s-6l s-7w">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="s-e0 s-e2 s-dp s-o9">
                  <Button variant="outline" onClick={handleRepeat} className="s-dn">
                    <RotateCcw className="s-fz s-xt" />
                    {t('script.repeat', 'Repeat')}
                  </Button>
                  <Button onClick={handleNextBeat} className="s-dn">
                    <ChevronRight className="s-fz s-xt" />
                    {aggregatedRange[1] + 1 < totalBeats
                      ? t('script.nextBeat', 'Next beat')
                      : t('script.finish', 'Finish')}
                  </Button>
                </div>

                {/* Aggregate / Disaggregate with tooltips */}
                <TooltipProvider>
                  <div className="s-c5 s-dp s-o7">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAggregate}
                          disabled={!canAggregate}
                          className="s-c6 s-dn s-vj"
                        >
                          <Merge className="s-fz s-xt" />
                          {t('script.aggregate', 'Add next beat')}
                          {canAggregate && (
                            <span className="s-ul">
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
                          className="s-c6 s-dn s-vj"
                        >
                          <Split className="s-fz s-xt" />
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
                className="s-t3"
              >
                <div className="s-u0 s-t1">
                  <Trophy className="s-fp s-xh s-uw s-m9" />
                  <h2 className="s-t9 s-cx">{t('script.sessionComplete', 'Lesson Complete!')}</h2>
                  <div>
                    <span className={`s-tc s-cx ${getScoreColor(overallScore)}`}>
                      {overallScore}%
                    </span>
                    <p className="s-ul s-lt">
                      {t('script.averageScore', 'Average score')}
                    </p>
                  </div>
                  {totalTimeMinutes > 0 && (
                    <p className="s-v9 s-ul">
                      {t('script.timeSpent', '{{minutes}} min', { minutes: totalTimeMinutes })}
                    </p>
                  )}
                </div>

                {/* Per-beat breakdown */}
                <div className="s-sy">
                  <p className="s-v9 s-d0">{t('script.perBeat', 'Per beat')}</p>
                  {sessionResults.map((sr, i) => (
                    <Card key={i}>
                      <CardContent className="s-mv s-c5 s-ib s-if">
                        <span className="s-v9">
                          {sr.beatStart === sr.beatEnd
                            ? t('script.beatNumber', { number: sr.beatStart + 1 })
                            : t('script.beatRange', { start: sr.beatStart + 1, end: sr.beatEnd + 1 })}
                        </span>
                        <div className="s-c5 s-ib s-dp">
                          <span className="s-vj s-ul">
                            {t('script.summaryMetrics', { content: sr.content_coverage, order: sr.order_accuracy })}
                          </span>
                          <span className={`s-v9 s-cx ${getScoreColor(sr.score)}`}>
                            {sr.score}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button size="lg" className="s-y7" onClick={onBack}>
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
