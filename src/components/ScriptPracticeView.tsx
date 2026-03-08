import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Play, Square, RotateCcw, ChevronRight, 
  Loader2, BookOpen, KeyRound, Mic, Merge, Split,
  CheckCircle2, XCircle, AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
}

type Phase = 'loading' | 'reading' | 'reference' | 'recording' | 'analyzing' | 'results';

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

  // Aggregation: which beats are combined for the current session
  const [aggregatedRange, setAggregatedRange] = useState<[number, number]>([0, 0]); // [start, end] inclusive

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Load beats on mount
  useEffect(() => {
    extractBeats();
  }, []);

  const extractBeats = async () => {
    setPhase('loading');
    try {
      const { data, error } = await supabase.functions.invoke('extract-reference-words', {
        body: { text: speechText, language: speechLanguage }
      });

      if (error) throw error;
      if (!data?.beats || data.beats.length === 0) throw new Error("No beats extracted");

      setBeats(data.beats);
      setCurrentBeatIndex(0);
      setAggregatedRange([0, 0]);
      setPhase('reading');
    } catch (err: any) {
      console.error("Error extracting beats:", err);
      toast({
        variant: "destructive",
        title: t('common.error', 'Error'),
        description: err.message || "Failed to process text",
      });
    }
  };

  const currentBeats = beats.slice(aggregatedRange[0], aggregatedRange[1] + 1);
  const currentText = currentBeats.map(b => b.text).join(' ');
  const currentReferenceWords = currentBeats.map(b => b.reference_word);
  const totalBeats = beats.length;
  const progressPercent = totalBeats > 0 ? ((aggregatedRange[1] + 1) / totalBeats) * 100 : 0;

  const handleContinueToReference = () => {
    setPhase('reference');
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
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
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        handleRecordingDone(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(200);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setPhase('recording');
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Microphone error",
        description: "Could not access microphone.",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const handleRecordingDone = async (audioBlob: Blob) => {
    setPhase('analyzing');

    try {
      // Transcribe
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('whisper-stream', {
            body: { audio: base64Audio, language: speechLanguage }
          });
          if (transcriptError) throw transcriptError;

          // Analyze retelling
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-retelling', {
            body: {
              originalText: currentText,
              transcript: transcriptData.transcript,
              language: speechLanguage,
            }
          });
          if (analysisError) throw analysisError;

          setResult(analysisData);
          setPhase('results');
        } catch (err: any) {
          console.error("Analysis error:", err);
          toast({ variant: "destructive", title: "Analysis failed", description: err.message });
          setPhase('reference');
        }
      };
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
      setPhase('reference');
    }
  };

  const handleRepeat = () => {
    setResult(null);
    setPhase('reading');
  };

  const handleNextBeat = () => {
    const nextIndex = aggregatedRange[1] + 1;
    if (nextIndex < totalBeats) {
      setAggregatedRange([nextIndex, nextIndex]);
      setCurrentBeatIndex(nextIndex);
      setResult(null);
      setPhase('reading');
    } else {
      // All beats done
      toast({ title: "🎉 " + t('script.allDone', 'All beats completed!') });
      onBack();
    }
  };

  const handleAggregate = () => {
    // Expand range to include next beat
    const newEnd = Math.min(aggregatedRange[1] + 1, totalBeats - 1);
    if (newEnd > aggregatedRange[1]) {
      setAggregatedRange([aggregatedRange[0], newEnd]);
      setResult(null);
      setPhase('reading');
    }
  };

  const handleDisaggregate = () => {
    // Shrink range back to single beat
    if (aggregatedRange[1] > aggregatedRange[0]) {
      setAggregatedRange([aggregatedRange[0], aggregatedRange[0]]);
      setResult(null);
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
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <div className="text-center">
          <p className="text-sm font-medium truncate max-w-[200px]">{speechTitle}</p>
          <p className="text-xs text-muted-foreground">
            {t('script.beatOf', 'Beat {{current}} of {{total}}', {
              current: aggregatedRange[1] + 1,
              total: totalBeats,
            })}
            {canDisaggregate && ` (${currentBeats.length} ${t('script.combined', 'combined')})`}
          </p>
        </div>
        <div className="w-20" />
      </div>

      {/* Progress */}
      <Progress value={progressPercent} className="h-1 rounded-none" />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            {/* PHASE: Reading the beat */}
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

            {/* PHASE: Show reference word(s) */}
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
                <div className="space-y-4">
                  {currentReferenceWords.map((word, i) => (
                    <span key={i} className="inline-block text-3xl font-bold text-primary/60 px-4 py-2">
                      {word}
                    </span>
                  ))}
                </div>

                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-24 h-24 rounded-full bg-destructive/10 border-4 border-destructive flex items-center justify-center mx-auto"
                >
                  <Mic className="h-10 w-10 text-destructive" />
                </motion.div>

                <p className="text-muted-foreground">
                  {t('script.speakingNow', 'Retell the beat from memory...')}
                </p>

                <Button
                  size="lg"
                  variant="destructive"
                  className="w-full gap-3"
                  onClick={handleStopRecording}
                >
                  <Square className="h-5 w-5" />
                  {t('script.stopRecording', 'Done speaking')}
                </Button>
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

                {/* Aggregate / Disaggregate */}
                <div className="flex gap-3 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAggregate}
                    disabled={!canAggregate}
                    className="flex-1 gap-2 text-xs"
                  >
                    <Merge className="h-4 w-4" />
                    {t('script.aggregate', 'Add next beat')}
                  </Button>
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ScriptPracticeView;
