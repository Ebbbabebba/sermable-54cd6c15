import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Play } from "lucide-react";
import PresentationSummary from "@/components/PresentationSummary";
import { PresentationModeSelector } from "@/components/PresentationModeSelector";
import { FullScriptView } from "@/components/FullScriptView";
import { CompactPresentationView } from "@/components/CompactPresentationView";
import OverviewPracticeView from "@/components/OverviewPracticeView";

import { AudienceOverlay } from "@/components/audience";
import type { ViewMode } from "@/components/WearableHUD";
import type { Environment } from "@/components/audience/types";

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
  presentation_mode?: 'strict' | 'fullscript';
  speech_type?: string;
}

const Presentation = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Mode selection
  const [selectedMode, setSelectedMode] = useState<'strict' | 'fullscript' | 'audience' | 'overview' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  
  // Session states
  const [stage, setStage] = useState<'mode-select' | 'prep' | 'live' | 'summary'>('mode-select');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Audience mode
  const [showAudienceOverlay, setShowAudienceOverlay] = useState(false);
  const [currentWordPerformance, setCurrentWordPerformance] = useState<{
    status: 'correct' | 'hesitated' | 'missed' | 'skipped';
    timeToSpeak?: number;
  } | null>(null);
  
  // Settings
  const [autoStopSilence, setAutoStopSilence] = useState(4);
  const [fontSize, setFontSize] = useState(40);
  
  // Results
  const [sessionResults, setSessionResults] = useState<any>(null);
  const [wordPerformanceData, setWordPerformanceData] = useState<WordPerformance[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSpeech();
    
    // ESC key to exit
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage === 'live' && isRecording) {
        handleStopRecording();
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, stage, isRecording]);

  const loadSpeech = async () => {
    try {
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpeech({
        ...data,
        presentation_mode: (data.presentation_mode === 'fullscript' ? 'fullscript' : 'strict') as 'strict' | 'fullscript'
      });
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
    setStartTime(Date.now());
    setElapsedTime(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - Date.now()) / 1000));
    }, 1000);
  };

  const handleRecordingStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Detect format
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      let mimeType = 'audio/webm';
      if (isIOS && MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        handleRecordingStop(audioBlob);
        
        // Stop stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start(200);
      mediaRecorderRef.current = mediaRecorder;
      
      setIsRecording(true);
      setStartTime(Date.now());
      
      // Update timer
      const recordStartTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - recordStartTime) / 1000));
      }, 1000);
      
      toast({
        title: "Recording started",
        description: "Speak naturally, the system is listening",
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Microphone error",
        description: "Could not access microphone. Please check permissions.",
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleRecordingStop = async (audioBlob: Blob) => {
    setIsProcessing(true);
    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          toast({
            title: "Processing...",
            description: "Analyzing your presentation",
          });

          // Transcribe with Whisper
          const { data: transcriptData, error: transcriptError } = await supabase.functions.invoke('whisper-stream', {
            body: { audio: base64Audio, language: speech?.speech_language || 'en' }
          });

          if (transcriptError) throw transcriptError;

          // Analyze presentation
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-presentation', {
            body: {
              transcript: transcriptData.transcript,
              originalText: speech!.text_original,
              speechId: speech!.id,
              durationSeconds: duration,
            }
          });

          if (analysisError) throw analysisError;

          // Save to database
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

          setSessionResults(analysisData);
          setStage('summary');
          setIsProcessing(false);

        } catch (error: any) {
          console.error('Error processing:', error);
          toast({
            variant: "destructive",
            title: "Processing failed",
            description: error.message,
          });
          setIsProcessing(false);
          setStage('prep');
        }
      };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      setIsProcessing(false);
      setStage('prep');
    }
  };

  const handleRetry = () => {
    setSessionResults(null);
    setStage('mode-select');
  };

  const handleExit = () => {
    navigate('/dashboard');
  };

  const handleModeSelect = (mode: 'strict' | 'fullscript') => {
    setSelectedMode(mode);
    
    if (mode === 'fullscript') {
      // Go straight to live for full script mode
      setStage('live');
    } else {
      // Strict mode goes directly to prep
      setStage('prep');
    }
  };

  const handleAudienceModeSelect = () => {
    setSelectedMode('audience');
    setShowAudienceOverlay(true);
    // Audience mode goes directly to prep
    setStage('prep');
  };

  const handleOverviewModeSelect = () => {
    setSelectedMode('overview');
    setStage('live');
  };

  const handleFullScriptComplete = (durationSeconds: number) => {
    // Simple completion - no analysis, just show success
    setElapsedTime(durationSeconds);
    setSessionResults({
      accuracy: 100,
      durationSeconds,
      hesitations: 0,
      missedWords: [],
      feedbackSummary: "Great practice session!",
      feedbackAdvice: "Keep practicing to build your confidence and fluency.",
      feedbackNextStep: "Try Strict Mode next to test your memorization."
    });
    setStage('summary');
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center overflow-hidden">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading presentation...</div>
        </div>
      </div>
    );
  }

  if (!speech) return null;

  // Show mode selector
  if (stage === 'mode-select') {
    return (
      <div className="h-screen bg-background overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Exit
          </Button>
        </div>
        <PresentationModeSelector 
          onSelectMode={handleModeSelect}
          onSelectAudienceMode={handleAudienceModeSelect}
          onSelectOverviewMode={handleOverviewModeSelect}
        />
      </div>
    );
  }


  // Show summary (for both modes)
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

  // Show full script live mode
  if (stage === 'live' && selectedMode === 'fullscript') {
    return (
      <FullScriptView
        text={speech.text_original}
        speechLanguage={speech.speech_language || 'en'}
        onComplete={handleFullScriptComplete}
        onExit={handleExit}
      />
    );
  }

  // Show overview mode
  if (selectedMode === 'overview') {
    return (
      <OverviewPracticeView
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

  // Show prep screen (for strict mode)
  if (stage === 'prep') {
    const modeLabel = 'Strict';
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={() => setStage('mode-select')}
            className="mb-4"
          >
            <X className="h-4 w-4 mr-2" />
            Back to Mode Selection
          </Button>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold capitalize">{speech.title}</h1>
            <p className="text-muted-foreground">
              {modeLabel} Mode • {speech.text_original.split(/\s+/).length} words
            </p>
          </div>

          <div className="p-6 bg-muted/30 rounded-lg space-y-4">
            <h3 className="font-semibold text-lg">Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Auto-stop after silence</label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={autoStopSilence}
                    onChange={(e) => setAutoStopSilence(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12">{autoStopSilence}s</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Text size</label>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="24"
                    max="56"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12">{fontSize}px</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
            <h4 className="font-semibold">How it works:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Keywords will be shown to guide you</li>
              <li>• Speak naturally - no feedback while presenting</li>
              <li>• Auto-stops after {autoStopSilence}s of silence</li>
              <li>• Get detailed analysis when you're done</li>
            </ul>
          </div>

          <Button
            size="lg"
            onClick={handleStartPresentation}
            className="w-full"
          >
            <Play className="h-5 w-5 mr-2" />
            Start Presentation
          </Button>
        </div>
      </div>
    );
  }

  // Handle performance data from strict presentation view
  const handlePerformanceData = async (data: WordPerformance[]) => {
    setWordPerformanceData(data);
    setIsProcessing(true);
    const duration = Math.floor((Date.now() - startTime) / 1000);

    try {
      toast({
        title: "Processing...",
        description: "Analyzing your presentation",
      });

      // Analyze presentation with detailed word performance
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-presentation', {
        body: {
          originalText: speech!.text_original,
          speechId: speech!.id,
          durationSeconds: duration,
          wordPerformance: data,
        }
      });

      if (analysisError) throw analysisError;

      // Save to database
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

      setSessionResults(analysisData);
      setStage('summary');
      setIsProcessing(false);

    } catch (error: any) {
      console.error('Error processing:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message,
      });
      setIsProcessing(false);
      setStage('prep');
    }
  };

  // Get environment for audience mode
  const audienceEnvironment = (speech.speech_type || 'general') as Environment;

  // Show strict presentation live view
  return (
    <>
      <CompactPresentationView
        text={speech.text_original}
        speechLanguage={speech.speech_language || 'en-US'}
        isRecording={isRecording}
        isProcessing={isProcessing}
        elapsedTime={elapsedTime}
        viewMode={viewMode}
        onStartRecording={handleRecordingStart}
        onStopRecording={handleStopRecording}
        onPerformanceData={handlePerformanceData}
        onExit={handleExit}
      />
      
      {/* Audience overlay for premium users */}
      {selectedMode === 'audience' && (
        <AudienceOverlay
          isVisible={showAudienceOverlay}
          environment={audienceEnvironment}
          onClose={() => setShowAudienceOverlay(false)}
          wordPerformance={currentWordPerformance}
        />
      )}
    </>
  );
};

export default Presentation;
