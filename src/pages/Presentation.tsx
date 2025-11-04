import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Mic, Square, Play } from "lucide-react";
import PresentationSummary from "@/components/PresentationSummary";
import { cn } from "@/lib/utils";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  speech_language: string;
}

const Presentation = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Session states
  const [stage, setStage] = useState<'prep' | 'live' | 'summary'>('prep');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Settings
  const [autoStopSilence, setAutoStopSilence] = useState(4);
  const [fontSize, setFontSize] = useState(40);
  
  // Results
  const [sessionResults, setSessionResults] = useState<any>(null);
  
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
      setSpeech(data);
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
    setStage('prep');
  };

  const handleExit = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading presentation...</div>
        </div>
      </div>
    );
  }

  if (!speech) return null;

  // Show summary
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
        onRetry={handleRetry}
        onExit={handleExit}
      />
    );
  }

  // Show prep screen
  if (stage === 'prep') {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Button
            variant="ghost"
            onClick={handleExit}
            className="mb-4"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{speech.title}</h1>
            <p className="text-muted-foreground">
              Presentation Mode • {speech.text_original.split(/\s+/).length} words
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

  // Show live presentation
  const displayText = speech.text_current || speech.text_original;
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Timer & Status */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-background/95 backdrop-blur-sm px-6 py-3 rounded-full border border-border shadow-lg">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <>
              <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium">Recording</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-muted" />
              <span className="text-sm font-medium text-muted-foreground">Ready</span>
            </>
          )}
        </div>
        <div className="text-sm font-mono">
          {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Main Content */}
      <div className="min-h-screen flex items-center justify-center p-8">
        <div 
          className="max-w-4xl mx-auto leading-relaxed text-center"
          style={{ fontSize: `${fontSize}px` }}
        >
          {displayText.split(/\s+/).map((word, index) => (
            <span key={index} className="inline-block px-1 opacity-80">
              {word}{' '}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
        <Button
          size="lg"
          variant={isRecording ? "destructive" : "default"}
          onClick={isRecording ? handleStopRecording : handleRecordingStart}
          disabled={isProcessing}
          className="rounded-full h-16 w-16 p-0 shadow-lg"
        >
          {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-lg font-medium">Analyzing your presentation...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Presentation;
