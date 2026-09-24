import { useEffect, useState, useRef } from "react";
import { requestMicrophoneAccess } from "@/utils/microphone";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Play, Settings, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import PresentationSummary from "@/components/PresentationSummary";
import { PresentationModeSelector } from "@/components/PresentationModeSelector";
import { CompactPresentationView } from "@/components/CompactPresentationView";
import ScriptPracticeView from "@/components/ScriptPracticeView";
import PresentationControls from "@/components/PresentationControls";
import { ProximityGuide } from "@/components/ProximityGuide";
import { stripStageDirections } from "@/utils/stageDirections";

interface WordPerformance {
  word: string;
  index: number;
  status: "correct" | "hesitated" | "missed" | "skipped";
  timeToSpeak?: number;
  wasPrompted: boolean;
  wrongWordsSaid?: string[];
}

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  speech_language: string;
  speech_type?: string;
}

const Presentation = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);

  // Mode selection: 'strict' = whole speech run-through, 'script' = beat retelling
  const [selectedMode, setSelectedMode] = useState<'strict' | 'script' | null>(null);
  // Whether the script is visible on screen during the run-through
  const [scriptHidden, setScriptHidden] = useState(false);

  // Session states
  const [stage, setStage] = useState<'mode-select' | 'prep' | 'live' | 'summary'>('mode-select');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [hintDelay, setHintDelay] = useState(700);
  const [sentenceStartDelay, setSentenceStartDelay] = useState(2500);

  // Results
  const [sessionResults, setSessionResults] = useState<any>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadSpeech();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ESC key to stop an ongoing run
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === 'live' && isRecording) {
        handleStopRecording();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [stage, isRecording]);

  const loadSpeech = async () => {
    try {
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpeech(data as Speech);
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

  const handleStartPresentation = () => {
    setStage('live');
    setElapsedTime(0);
  };

  const startTimer = () => {
    const recordStartTime = Date.now();
    setStartTime(recordStartTime);
    setElapsedTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - recordStartTime) / 1000));
    }, 1000);
  };

  // Speech recognition lives inside CompactPresentationView; here we only make
  // sure the microphone permission is granted and keep the session timer.
  const handleRecordingStart = async () => {
    try {
      const stream = await requestMicrophoneAccess({
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      streamRef.current = stream;
      setIsRecording(true);
      startTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: t('presentation.micErrorTitle', 'Microphone error'),
        description: t('presentation.micErrorDesc', 'Could not access the microphone. Please check permissions.'),
      });
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const handleRetry = () => {
    setSessionResults(null);
    setStage('mode-select');
    setSelectedMode(null);
  };

  const handleExit = () => {
    navigate('/dashboard');
  };

  const handleModeSelect = (mode: 'strict' | 'overview') => {
    if (mode === 'overview') {
      setSelectedMode('script');
      setStage('live');
      return;
    }
    setSelectedMode('strict');
    setStage('prep');
  };

  // Analyse and persist a completed run-through (visible or hidden script)
  const handlePerformanceData = async (data: WordPerformance[]) => {
    setIsProcessing(true);
    const duration = Math.max(1, Math.floor((Date.now() - startTime) / 1000));

    try {
      toast({
        title: t('presentation.processing'),
        description: t('presentation.processingDesc'),
      });

      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-presentation', {
        body: {
          originalText: stripStageDirections(speech!.text_original),
          speechId: speech!.id,
          durationSeconds: duration,
          wordPerformance: data,
          scriptHidden,
          feedbackLanguage: i18n.language || speech?.speech_language || 'en',
        }
      });

      if (analysisError) throw analysisError;

      const { error: saveError } = await supabase
        .from('presentation_sessions')
        .insert({
          speech_id: speech!.id,
          transcript: analysisData.transcript,
          accuracy: analysisData.accuracy,
          hesitations: analysisData.hesitations,
          missed_words: analysisData.missedWords,
          duration_seconds: duration,
          feedback_summary: analysisData.feedbackSummary,
          feedback_advice: analysisData.feedbackAdvice,
          feedback_next_step: analysisData.feedbackNextStep,
        });

      if (saveError) {
        console.error('Error saving session:', saveError);
      }

      setSessionResults({ ...analysisData, durationSeconds: duration });
      setStage('summary');
      setIsProcessing(false);
    } catch (error: any) {
      console.error('Error processing:', error);
      toast({
        variant: "destructive",
        title: t('presentation.processingFailed', 'Processing failed'),
        description: error.message,
      });
      setIsProcessing(false);
      setStage('prep');
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center overflow-hidden">
        <div className="animate-pulse text-muted-foreground">{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!speech) return null;

  // Mode selector
  if (stage === 'mode-select') {
    return (
      <div className="h-screen bg-background overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <div className="absolute left-4 z-10" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2 bg-background/80 backdrop-blur-sm rounded-full"
          >
            <X className="h-4 w-4" />
            {t('common.exit')}
          </Button>
        </div>
        <PresentationModeSelector onSelectMode={handleModeSelect} />
      </div>
    );
  }

  // Summary
  if (stage === 'summary' && sessionResults) {
    return (
      <PresentationSummary
        accuracy={sessionResults.accuracy}
        duration={sessionResults.durationSeconds}
        hesitations={sessionResults.hesitations}
        missedWords={sessionResults.missedWords}
        feedbackSummary={sessionResults.feedbackSummary}
        feedbackAdvice={sessionResults.feedbackAdvice}
        feedbackNextStep={sessionResults.feedbackNextStep}
        onExit={handleExit}
      />
    );
  }

  // Script mode
  if (selectedMode === 'script') {
    return (
      <ScriptPracticeView
        speechId={speech.id}
        speechTitle={speech.title}
        speechText={speech.text_original}
        speechLanguage={speech.speech_language || 'en'}
        onBack={() => {
          setSelectedMode(null);
          setStage('mode-select');
        }}
      />
    );
  }

  // Prep screen (whole speech mode)
  if (stage === 'prep') {
    return (
      <div className="min-h-screen bg-background p-6 md:p-8" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 2rem)' }}>
        <div className="absolute right-4 z-10" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => setStage('mode-select')}
            className="mb-2 rounded-full"
          >
            <X className="h-4 w-4 mr-2" />
            {t('presentation.backToModeSelection')}
          </Button>

          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold capitalize">{speech.title}</h1>
            <p className="text-muted-foreground">
              {t('presentation.wholeSpeechModeLabel', 'Whole Speech Mode')} • {t('presentation.wordsCount', { count: stripStageDirections(speech.text_original).split(/\s+/).filter(Boolean).length })}
            </p>
          </div>

          {/* Script visibility choice */}
          <div className="p-4 bg-muted/40 rounded-3xl border border-border space-y-3">
            <p className="text-sm font-medium">{t('presentation.scriptVisibilityTitle', 'Script on screen')}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScriptHidden(false)}
                className={cn(
                  "rounded-2xl border-2 p-3 text-left transition-colors",
                  !scriptHidden ? "border-primary bg-primary/10" : "border-border bg-background"
                )}
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  <Eye className="h-4 w-4" />
                  {t('presentation.scriptVisible', 'Show script')}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  {t('presentation.scriptVisibleDesc', 'Teleprompter follows along as you speak.')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScriptHidden(true)}
                className={cn(
                  "rounded-2xl border-2 p-3 text-left transition-colors",
                  scriptHidden ? "border-primary bg-primary/10" : "border-border bg-background"
                )}
              >
                <span className="flex items-center gap-2 font-medium text-sm">
                  <EyeOff className="h-4 w-4" />
                  {t('presentation.scriptHidden', 'Hide script')}
                </span>
                <span className="block text-xs text-muted-foreground mt-1">
                  {t('presentation.scriptHiddenDesc', 'Empty screen — words appear only when you hesitate.')}
                </span>
              </button>
            </div>
          </div>

          <div className="p-6 bg-primary/5 rounded-3xl border border-primary/20 space-y-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">1</div>
                <div>
                  <p className="font-medium text-sm">{t('presentation.step1Title')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('presentation.step1Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">2</div>
                <div>
                  <p className="font-medium text-sm">{t('presentation.step2Title')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('presentation.step2Desc')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">3</div>
                <div>
                  <p className="font-medium text-sm">{t('presentation.step3Title')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('presentation.step3Desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <ProximityGuide />

          <Button
            size="xl"
            variant="apple"
            onClick={handleStartPresentation}
            className="w-full"
          >
            <Play className="h-5 w-5 mr-2" />
            {t('presentation.startPresentation')}
          </Button>
        </div>

        {showSettings && (
          <PresentationControls
            hintDelay={hintDelay}
            setHintDelay={setHintDelay}
            sentenceStartDelay={sentenceStartDelay}
            setSentenceStartDelay={setSentenceStartDelay}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  // Live run-through
  return (
    <>
      <CompactPresentationView
        text={speech.text_original}
        speechLanguage={speech.speech_language || 'en-US'}
        isRecording={isRecording}
        isProcessing={isProcessing}
        elapsedTime={elapsedTime}
        scriptHidden={scriptHidden}
        onStartRecording={handleRecordingStart}
        onStopRecording={handleStopRecording}
        onPerformanceData={handlePerformanceData}
        onExit={handleExit}
        hintDelay={hintDelay}
        sentenceStartDelay={sentenceStartDelay}
      />

      <div className="fixed right-4 z-50" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="bg-background/50 backdrop-blur-sm rounded-full"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {showSettings && (
        <PresentationControls
          hintDelay={hintDelay}
          setHintDelay={setHintDelay}
          sentenceStartDelay={sentenceStartDelay}
          setSentenceStartDelay={setSentenceStartDelay}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

export default Presentation;
