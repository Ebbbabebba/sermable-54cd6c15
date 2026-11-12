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
import KeycardsView from "@/components/KeycardsView";
import PresentationControls from "@/components/PresentationControls";
import { ProximityGuide } from "@/components/ProximityGuide";
import { stripStageDirections } from "@/utils/stageDirections";
import AnalysisPending from '@/components/AnalysisPending';
import RecordedFeedback from '@/components/RecordedFeedback';
import { analyzeRecording, measurePauses } from '@/lib/recordedSpeech';
import { saveRecordingDraft, loadRecordingDraft, type RecordingDraft } from '@/lib/recordingDraft';
import type { SpeechAnalysis } from '@/lib/feedbackContract';

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
  const [selectedMode, setSelectedMode] = useState<'strict' | 'script' | 'keycards' | null>(null);
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
  const [sessionResults, setSessionResults] = useState<SpeechAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [recordingDraft, setRecordingDraft] = useState<RecordingDraft | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopPauseMeasurement = useRef<(() => {start: number; duration: number}[]) | null>(null);
  const recordingStartedRef = useRef(0);

  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    void loadRecordingDraft(`presentation:${id}`).then(draft => {
      if (draft) { setRecordingDraft(draft); setAnalysisError('En tidigare inspelning finns kvar och kan analyseras igen.'); }
    }).catch(() => {});
  }, [id]);
  useEffect(() => {
    if (!recordingDraft) return;
    const url = URL.createObjectURL(recordingDraft.blob); setRecordingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordingDraft]);

  useEffect(() => {
    loadSpeech();

    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopPauseMeasurement.current?.(); stopPauseMeasurement.current = null;
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
      const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        if (!speech) return;
        const durationSeconds = Math.max(0.1, (performance.now() - recordingStartedRef.current) / 1000);
        const pauses = stopPauseMeasurement.current?.() ?? []; stopPauseMeasurement.current = null;
        const draft: RecordingDraft = {id:`presentation:${speech.id}`,blob:new Blob(chunks,{type:recorder.mimeType}),durationSeconds,pauses,originalText:stripStageDirections(speech.text_original),language:speech.speech_language};
        setRecordingDraft(draft);
        void runAnalysis(draft);
      };
      recorderRef.current = recorder;
      stopPauseMeasurement.current = measurePauses(stream);
      recordingStartedRef.current = performance.now();
      recorder.start(250);
      setIsRecording(true);
      startTimer();
    } catch (error) {
      streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: t('presentation.micErrorTitle', 'Microphone error'),
        description: t('presentation.micErrorDesc', 'Could not access the microphone. Please check permissions.'),
      });
    }
  };

  const handleStopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
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

  const handleModeSelect = (mode: 'strict' | 'overview' | 'keycards') => {
    if (mode === 'keycards') {
      setSelectedMode('keycards');
      setStage('live');
      return;
    }
    if (mode === 'overview') {
      setSelectedMode('script');
      setStage('live');
      return;
    }
    setSelectedMode('strict');
    setStage('prep');
  };

  // Recognition cursor statuses are not evidence of speech; analyze the captured audio.
  const runAnalysis = async (draft: RecordingDraft) => {
    setIsProcessing(true);
    setAnalysisError('');
    try {
      await saveRecordingDraft(draft);
      const analysisData = await analyzeRecording(draft);
      setSessionResults(analysisData);
      setStage('summary');
      if (speech) {
        const {data:{user}} = await supabase.auth.getUser();
        if (user) void supabase.from('presentation_sessions').insert({speech_id:speech.id,user_id:user.id,transcript:analysisData.transcript,duration_seconds:draft.durationSeconds,hesitations:analysisData.metrics.fillers.length,feedback_summary:analysisData.feedback.summary,feedback_advice:analysisData.feedback.tips.map(tip=>tip.text).join('\n'),feedback_next_step:analysisData.feedback.positive}).then(({error})=>{if(error)console.error('Session save failed');});
      }
    } catch (error) { setAnalysisError(error instanceof Error ? error.message : 'Analysen misslyckades. Inspelningen finns kvar.'); }
    finally { setIsProcessing(false); }
  };

  if (loading) {
    return (
      <div className="s-gi s-3v s-c5 s-ib s-ig s-mn">
        <div className="s-30 s-ul">{t('common.loading', 'Loading...')}</div>
      </div>
    );
  }

  if (!speech) return null;

  if (isProcessing) return <AnalysisPending />;
  if (analysisError && recordingDraft) return <div className="analysis-recovery" lang="sv" role="alert">
    <h1>Analysen kunde inte slutföras</h1><p>{analysisError}</p>
    <audio controls src={recordingUrl}/><a href={recordingUrl} download="sermable-inspelning">Spara inspelningen</a>
    <Button onClick={() => void runAnalysis(recordingDraft)}>Försök igen</Button>
    <Button variant="outline" onClick={() => {setAnalysisError('');setStage('prep');}}>Tillbaka</Button>
  </div>;

  // Mode selector
  if (stage === 'mode-select') {
    return (
      <div className="s-gi s-3v s-mn" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <div className="s-26 s-iw s-ye" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="s-dn s-40 s-3h s-qe"
          >
            <X className="s-fz s-xt" />
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
      <div className="s-l6 s-3v s-2y"><RecordedFeedback analysis={sessionResults}/>
        <audio controls src={recordingUrl}/><Button onClick={handleExit}>{t('common.exit')}</Button>
      </div>
    );
  }

  if (selectedMode === 'keycards') {
    return (
      <KeycardsView
        speechId={speech.id}
        speechText={speech.text_original}
        onBack={() => { setSelectedMode(null); setStage('mode-select'); }}
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
      <div className="s-l6 s-3v s-my s-kc" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 2rem)' }}>
        <div className="s-26 s-pi s-ye" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="s-g1 s-xv" />
          </Button>
        </div>

        <div className="s-jc s-m9 s-t3">
          <Button
            variant="ghost"
            onClick={() => setStage('mode-select')}
            className="s-jy s-qe"
          >
            <X className="s-fz s-xt s-lp" />
            {t('presentation.backToModeSelection')}
          </Button>

          <div className="s-sy">
            <h1 className="s-ta s-kk s-cx s-8i">{speech.title}</h1>
            <p className="s-ul">
              {t('presentation.wholeSpeechModeLabel', 'Whole Speech Mode')} • {t('presentation.wordsCount', { count: stripStageDirections(speech.text_original).split(/\s+/).filter(Boolean).length })}
            </p>
          </div>

          {/* Script visibility choice */}
          <div className="s-mw s-55 s-qa s-6l s-6x s-t0">
            <p className="s-v9 s-d0">{t('presentation.scriptVisibilityTitle', 'Script on screen')}</p>
            <div className="s-e0 s-e2 s-dn">
              <button
                type="button"
                onClick={() => setScriptHidden(false)}
                className={cn(
                  "s-q9 s-6n s-mv s-uj s-ws",
                  !scriptHidden ? "s-7n s-5e" : "s-6x s-3v"
                )}
              >
                <span className="s-c5 s-ib s-dn s-d0 s-v9">
                  <Eye className="s-fz s-xt" />
                  {t('presentation.scriptVisible', 'Show script')}
                </span>
                <span className="s-6i s-vj s-ul s-lt">
                  {t('presentation.scriptVisibleDesc', 'Teleprompter follows along as you speak.')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setScriptHidden(true)}
                className={cn(
                  "s-q9 s-6n s-mv s-uj s-ws",
                  scriptHidden ? "s-7n s-5e" : "s-6x s-3v"
                )}
              >
                <span className="s-c5 s-ib s-dn s-d0 s-v9">
                  <EyeOff className="s-fz s-xt" />
                  {t('presentation.scriptHidden', 'Hide script')}
                </span>
                <span className="s-6i s-vj s-ul s-lt">
                  {t('presentation.scriptHiddenDesc', 'Empty screen — words appear only when you hesitate.')}
                </span>
              </button>
            </div>
          </div>

          <div className="s-my s-5j s-qa s-6l s-7p s-t1">
            <div className="s-t1">
              <div className="s-c5 s-id s-dp">
                <div className="s-ca s-xy s-g4 s-qe s-5e s-c5 s-ib s-ig s-v9 s-d3 s-uw">1</div>
                <div>
                  <p className="s-d0 s-v9">{t('presentation.step1Title')}</p>
                  <p className="s-vj s-ul s-ls">{t('presentation.step1Desc')}</p>
                </div>
              </div>
              <div className="s-c5 s-id s-dp">
                <div className="s-ca s-xy s-g4 s-qe s-5e s-c5 s-ib s-ig s-v9 s-d3 s-uw">2</div>
                <div>
                  <p className="s-d0 s-v9">{t('presentation.step2Title')}</p>
                  <p className="s-vj s-ul s-ls">{t('presentation.step2Desc')}</p>
                </div>
              </div>
              <div className="s-c5 s-id s-dp">
                <div className="s-ca s-xy s-g4 s-qe s-5e s-c5 s-ib s-ig s-v9 s-d3 s-uw">3</div>
                <div>
                  <p className="s-d0 s-v9">{t('presentation.step3Title')}</p>
                  <p className="s-vj s-ul s-ls">{t('presentation.step3Desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <ProximityGuide />

          <Button
            size="xl"
            variant="apple"
            onClick={handleStartPresentation}
            className="s-y7"
          >
            <Play className="s-g1 s-xv s-lp" />
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
        onPerformanceData={() => {}}
        onExit={handleExit}
        hintDelay={hintDelay}
        sentenceStartDelay={sentenceStartDelay}
      />

      <div className="s-c4 s-pi s-yh" style={{ top: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="s-3x s-3h s-qe"
        >
          <Settings className="s-g1 s-xv" />
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
