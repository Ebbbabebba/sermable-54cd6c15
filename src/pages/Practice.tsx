import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AudioRecorder from "@/components/AudioRecorder";
import WordHighlighter from "@/components/WordHighlighter";
import PracticeResults from "@/components/PracticeResults";
import RealtimeWordTracker from "@/components/RealtimeWordTracker";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
}

interface SessionResults {
  transcription: string;
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  analysis: string;
  cueText: string;
}

const Practice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcription, setTranscription] = useState("");
  const recognitionRef = useRef<any>(null);
  const durationIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadSpeech();
  }, [id]);

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

  const handleStartPractice = () => {
    setIsPracticing(true);
    setShowResults(false);
    setSessionResults(null);
    toast({
      title: "Practice mode activated",
      description: "Read your speech aloud when ready, then start recording.",
    });
  };

  const handleRecordingStart = async () => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      }

      // Request microphone permission explicitly
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        throw new Error("Microphone access denied. Please allow microphone access and try again.");
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      setTranscription("");
      setRecordingDuration(0);

      recognition.onstart = () => {
        console.log('Speech recognition started successfully');
        setIsRecording(true);
        durationIntervalRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        toast({
          title: "🎙️ Recording Active",
          description: "Microphone is listening. Start speaking now.",
        });
      };

      recognition.onresult = (event: any) => {
        console.log('Speech detected:', event.results.length, 'segments');
        let currentTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + " ";
        }
        const finalTranscript = currentTranscript.trim();
        setTranscription(finalTranscript);
        console.log('Current transcription length:', finalTranscript.length);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
          toast({
            variant: "destructive",
            title: "No speech detected",
            description: "Please speak louder or check your microphone.",
          });
        } else if (event.error === 'aborted') {
          // Ignore aborted errors when user stops manually
          console.log('Recognition aborted by user');
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          toast({
            variant: "destructive",
            title: "Microphone access denied",
            description: "Please allow microphone access in your browser settings.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Speech recognition error",
            description: `Error: ${event.error}. Try speaking more clearly.`,
          });
        }
      };

      recognition.onend = () => {
        // Only restart if still supposed to be recording
        if (isRecording && recognitionRef.current) {
          console.log('Recognition ended unexpectedly, restarting...');
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.log('Could not restart recognition:', e);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast({
        variant: "destructive",
        title: "Speech recognition unavailable",
        description: error.message || "Please use Chrome or Edge browser for best results.",
      });
    }
  };

  const handleRecordingStop = async () => {
    setIsRecording(false);
    
    // Clear duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (!transcription || transcription.trim().length === 0) {
      toast({
        variant: "destructive",
        title: "No speech detected",
        description: "Please speak clearly during recording and try again.",
      });
      return;
    }

    setIsProcessing(true);

    try {
      toast({
        title: "Analyzing...",
        description: "AI is analyzing your performance",
      });

      // Analyze the transcription
      const { data, error } = await supabase.functions.invoke('analyze-speech', {
        body: {
          transcription: transcription.trim(),
          originalText: speech!.text_current,
          speechId: speech!.id,
        },
      });

      if (error) throw error;

      setSessionResults(data);
      setShowResults(true);

      // Save practice session to database
      const { error: sessionError } = await supabase
        .from('practice_sessions')
        .insert({
          speech_id: speech!.id,
          score: data.accuracy,
          missed_words: data.missedWords,
          delayed_words: data.delayedWords,
          duration: recordingDuration,
        });

      if (sessionError) {
        console.error('Error saving session:', sessionError);
      }

      // Update speech with new cue text
      const { error: updateError } = await supabase
        .from('speeches')
        .update({ text_current: data.cueText })
        .eq('id', speech!.id);

      if (updateError) {
        console.error('Error updating speech:', updateError);
      } else {
        loadSpeech();
      }

      toast({
        title: "Analysis complete!",
        description: `${data.accuracy}% accuracy. Check your results below.`,
      });

    } catch (error: any) {
      console.error('Error processing recording:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message || "Failed to process your recording. Please try again.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewSession = () => {
    setShowResults(false);
    setSessionResults(null);
    setIsPracticing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!speech) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{speech.title}</h1>
            <p className="text-muted-foreground">
              Practice session • {speech.text_current.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Session Progress</CardTitle>
              <CardDescription>Track your practice performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Memorization</span>
                  <span className="font-medium">
                    {sessionResults ? `${sessionResults.accuracy}%` : '0%'}
                  </span>
                </div>
                <Progress value={sessionResults?.accuracy || 0} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Practice Mode</CardTitle>
                  <CardDescription>
                    {!isPracticing
                      ? "Click start to begin your practice session"
                      : isRecording
                      ? "Recording... speak clearly"
                      : isProcessing
                      ? "AI is analyzing your performance..."
                      : "Read the text aloud and record yourself"}
                  </CardDescription>
                </div>
                {showResults && (
                  <Button variant="outline" size="sm" onClick={handleNewSession}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    New Session
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isPracticing ? (
                <div className="text-center py-12">
                  <Button size="lg" onClick={handleStartPractice}>
                    <Play className="h-5 w-5 mr-2" />
                    Start Practice Session
                  </Button>
                </div>
              ) : isProcessing ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold mb-2">Analyzing Your Performance...</h3>
                  <p className="text-muted-foreground">AI is comparing your speech and identifying areas for improvement</p>
                </div>
              ) : (
                <>
                  <div className="p-6 bg-muted/30 rounded-lg">
                    {showResults && sessionResults ? (
                      <WordHighlighter
                        text={speech.text_current}
                        missedWords={sessionResults.missedWords}
                        delayedWords={sessionResults.delayedWords}
                      />
                    ) : isRecording ? (
                      <div className="space-y-4">
                        <div className="text-center py-8">
                          <div className="inline-flex items-center gap-3 px-6 py-3 bg-destructive/10 rounded-full">
                            <div className="h-3 w-3 rounded-full bg-destructive animate-pulse"></div>
                            <span className="text-lg font-semibold">Recording: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                          </div>
                          <p className="mt-4 text-sm text-muted-foreground">🎙️ Beta: Browser Speech Recognition Active</p>
                        </div>
                        <div className="prose prose-lg max-w-none opacity-50">
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {speech.text_current}
                          </p>
                        </div>
                        {transcription && (
                          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                            <p className="text-sm font-medium mb-2">Live Transcription:</p>
                            <p className="text-sm">{transcription}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-lg max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {speech.text_current}
                        </p>
                      </div>
                    )}
                  </div>

                  {!showResults && (
                    <div className="flex justify-center">
                      <AudioRecorder
                        isRecording={isRecording}
                        onStart={handleRecordingStart}
                        onStop={handleRecordingStop}
                        disabled={isProcessing}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {showResults && sessionResults && (
            <div className="animate-slide-up space-y-4">
              <PracticeResults
                accuracy={sessionResults.accuracy}
                missedWords={sessionResults.missedWords}
                delayedWords={sessionResults.delayedWords}
                analysis={sessionResults.analysis}
                transcription={sessionResults.transcription}
              />

              {(sessionResults.missedWords.length > 0 || sessionResults.delayedWords.length > 0) && (
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle>Practice Problem Words</CardTitle>
                    <CardDescription>
                      Your script has been simplified to focus on {sessionResults.missedWords.length + sessionResults.delayedWords.length} words that need practice
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <p className="text-lg leading-relaxed font-medium">
                        {sessionResults.cueText}
                      </p>
                    </div>
                    <Button 
                      size="lg" 
                      className="w-full"
                      onClick={handleNewSession}
                    >
                      Practice with Problem Words Only
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Practice;
