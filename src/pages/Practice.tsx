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
import BottomNav from "@/components/BottomNav";
import FeedbackScreen from "@/components/FeedbackScreen";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  speech_language?: string;
  mastery_level?: number;
}

interface SessionResults {
  transcription: string;
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  fillerWords: { [key: string]: number };
  toneFeedback: string;
  analysis: string;
  cueText: string;
  nextPracticeInterval?: number;
  nextPracticeDate?: string;
  masteryLevel?: number;
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [transcription, setTranscription] = useState("");
  const recognitionRef = useRef<any>(null);
  const shouldBeRecordingRef = useRef(false);

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
    
    const isCueMode = speech?.text_current !== speech?.text_original;
    toast({
      title: "Practice mode activated",
      description: isCueMode 
        ? "Use the cue words to help you recall and speak the ENTIRE speech from memory."
        : "Read your speech aloud when ready, then start recording.",
    });
  };

  const handleRecordingStart = async () => {
    try {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        throw new Error("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      }

      console.log('🎤 Starting speech recognition...');

      // Clean up any existing recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (e) {
          console.log('Cleanup error:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // Use speech's language for accurate recognition
      const speechLang = speech?.speech_language || 'en';
      const langCode = speechLang === 'en' ? 'en-US' : 
                       speechLang === 'sv' ? 'sv-SE' :
                       speechLang === 'es' ? 'es-ES' :
                       speechLang === 'fr' ? 'fr-FR' :
                       speechLang === 'de' ? 'de-DE' :
                       speechLang === 'it' ? 'it-IT' :
                       speechLang === 'pt' ? 'pt-PT' :
                       speechLang === 'ru' ? 'ru-RU' :
                       speechLang === 'zh' ? 'zh-CN' :
                       speechLang === 'ja' ? 'ja-JP' : 'en-US';
      recognition.lang = langCode;
      recognition.maxAlternatives = 1;
      
      console.log(`🌐 Language: ${langCode}`);

      setTranscription("");
      shouldBeRecordingRef.current = true;

      recognition.onstart = () => {
        console.log('✅ Recognition started');
        setIsRecording(true);
        recognitionRef.current = recognition;
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + " ";
        }
        setTranscription(transcript.trim());
        console.log('📝 Speech detected:', transcript.trim().substring(0, 30) + '...');
      };

      recognition.onerror = (event: any) => {
        console.error('❌ Error:', event.error);
        
        if (event.error === 'aborted') {
          // Stop restarting on abort - it means there's a conflict
          console.log('⚠️ Abort detected - stopping restart loop');
          shouldBeRecordingRef.current = false;
          setIsRecording(false);
          toast({
            title: "Speech recognition stopped",
            description: "Please try clicking Start Recording again.",
          });
        } else if (event.error === 'not-allowed') {
          shouldBeRecordingRef.current = false;
          setIsRecording(false);
          toast({
            variant: "destructive",
            title: "Microphone access denied",
            description: "Please allow microphone access and try again.",
          });
        }
      };

      recognition.onend = () => {
        console.log('🔄 Recognition ended');
        
        if (shouldBeRecordingRef.current) {
          console.log('↻ Restarting in 500ms...');
          setTimeout(() => {
            if (shouldBeRecordingRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.log('Restart error:', e);
                shouldBeRecordingRef.current = false;
                setIsRecording(false);
              }
            }
          }, 500);
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error: any) {
      console.error('💥 Fatal error:', error);
      shouldBeRecordingRef.current = false;
      toast({
        variant: "destructive",
        title: "Speech recognition unavailable",
        description: error.message || "Please use Chrome or Edge browser.",
      });
    }
  };

  const handleRecordingStop = async () => {
    console.log('🛑 Stopping recording...');
    shouldBeRecordingRef.current = false;

    // Stop speech recognition and clear handlers
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      
      try {
        // Clear handlers to prevent restart
        recognition.onend = null;
        recognition.onerror = null;
        recognition.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
    
    setIsRecording(false);

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

      // Get user's feedback language preference
      const { data: userData } = await supabase.auth.getUser();
      const { data: profileData } = await supabase
        .from('profiles')
        .select('feedback_language')
        .eq('id', userData.user!.id)
        .maybeSingle();

      // CRITICAL: Analyze against the FULL ORIGINAL speech, not just cue words
      // This ensures we're testing full memorization, using cue words as prompts
      const { data, error } = await supabase.functions.invoke('analyze-speech', {
        body: {
          transcription: transcription.trim(),
          originalText: speech!.text_original, // Full speech for comparison
          cueText: speech!.text_current, // Cue words shown to user
          speechId: speech!.id,
          speechLanguage: speech!.speech_language || 'en',
          feedbackLanguage: profileData?.feedback_language || 'sv'
        },
      });

      if (error) throw error;

      setSessionResults(data);
      setShowFeedback(true); // Show feedback screen first
      
      // After feedback, show detailed results
      setTimeout(() => {
        setShowFeedback(false);
        setShowResults(true);
      }, 3000);

      // Save practice session to database
      const { error: sessionError } = await supabase
        .from('practice_sessions')
        .insert({
          speech_id: speech!.id,
          score: data.accuracy,
          missed_words: data.missedWords,
          delayed_words: data.delayedWords,
          duration: 0, // Duration tracking removed
          filler_words: data.fillerWords,
          tone_feedback: data.toneFeedback,
          analysis: data.analysis,
          cue_text: data.cueText,
          transcription: data.transcription
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

      const nextPracticeDays = data.nextPracticeInterval || 1;
      const masteryPercent = data.masteryLevel || 0;
      
      toast({
        title: "Analysis complete!",
        description: `${data.accuracy}% accuracy. Mastery: ${masteryPercent}%. Next practice in ${nextPracticeDays} day${nextPracticeDays !== 1 ? 's' : ''}.`,
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
    setShowFeedback(false);
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
    <div className="min-h-screen pb-24">
      <header className="border-b border-border/50 bg-card backdrop-blur-lg bg-card/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="hover-scale">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6 animate-fade-in">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{speech.title}</h1>
            <p className="text-muted-foreground">
              Practice session • {speech.text_original.split(/\s+/).filter(Boolean).length} words (full speech)
            </p>
            {speech.text_current !== speech.text_original && (
              <p className="text-sm text-primary mt-1">
                📝 Using cue words as memory prompts - speak the entire speech
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Full Speech Progress</CardTitle>
              <CardDescription>
                {speech.text_current !== speech.text_original 
                  ? "You're practicing with cue words - AI tracks your full speech recall"
                  : "Track your practice performance"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Full Speech Memorization</span>
                  <span className="font-medium">
                    {sessionResults ? `${sessionResults.accuracy}%` : `${Math.round(speech.mastery_level || 0)}%`}
                  </span>
                </div>
                <Progress value={sessionResults?.accuracy || speech.mastery_level || 0} />
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
                      ? "Recording... speak the FULL speech from memory"
                      : isProcessing
                      ? "AI is analyzing your full speech performance..."
                      : speech.text_current !== speech.text_original
                      ? "Use the cue words below to recall and speak the entire speech"
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
                          <div className="inline-flex items-center gap-3 px-6 py-3 bg-success/20 rounded-full">
                            <div className="h-3 w-3 rounded-full bg-success animate-pulse"></div>
                            <span className="text-lg font-semibold text-success">🎤 Listening...</span>
                          </div>
                          <p className="mt-4 text-sm text-muted-foreground">Speak clearly - words will highlight as you say them</p>
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
              {sessionResults.nextPracticeInterval && (
                <Card className="border-primary bg-primary/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-primary">Next Practice Schedule</p>
                        <p className="text-2xl font-bold mt-1">
                          {sessionResults.nextPracticeInterval} day{sessionResults.nextPracticeInterval !== 1 ? 's' : ''}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {sessionResults.nextPracticeDate && `Practice again on ${new Date(sessionResults.nextPracticeDate).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-primary">Memory Mastery</p>
                        <p className="text-3xl font-bold mt-1">{sessionResults.masteryLevel || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <PracticeResults
                accuracy={sessionResults.accuracy}
                missedWords={sessionResults.missedWords}
                delayedWords={sessionResults.delayedWords}
                fillerWords={sessionResults.fillerWords}
                toneFeedback={sessionResults.toneFeedback}
                analysis={sessionResults.analysis}
                transcription={sessionResults.transcription}
              />

              {(sessionResults.missedWords.length > 0 || sessionResults.delayedWords.length > 0) && (
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle>Updated Practice Script</CardTitle>
                    <CardDescription>
                      Your cue words have been updated based on this session's performance. 
                      Words you mastered are removed. Challenging sections remain for focused practice.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <p className="text-sm font-medium mb-2 text-primary">
                        📝 Updated Cue Words for Next Practice:
                      </p>
                      <p className="whitespace-pre-wrap leading-relaxed text-base">
                        {sessionResults.cueText}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>
                        <strong>How to use:</strong> These cue words will help trigger your memory of the full speech. 
                        The "..." sections represent parts you've mastered.
                      </p>
                      <p>
                        <strong>Next session:</strong> Use these updated cue words to practice. 
                        Remember to speak the ENTIRE speech, not just the cue words!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
      
      <BottomNav />

      {/* Feedback Screen Overlay */}
      {showFeedback && sessionResults && (
        <FeedbackScreen 
          accuracy={sessionResults.accuracy}
          onComplete={() => {
            setShowFeedback(false);
            setShowResults(true);
          }}
        />
      )}
    </div>
  );
};

export default Practice;
