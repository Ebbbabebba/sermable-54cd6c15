import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Play, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AudioRecorder from "@/components/AudioRecorder";
import WordHighlighter from "@/components/WordHighlighter";
import PracticeResults from "@/components/PracticeResults";
import EnhancedWordTracker from "@/components/EnhancedWordTracker";
import PracticeSettings, { PracticeSettingsConfig } from "@/components/PracticeSettings";
import LoadingOverlay from "@/components/LoadingOverlay";

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
  const resultsRef = useRef<HTMLDivElement>(null);
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResults | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [settings, setSettings] = useState<PracticeSettingsConfig>({
    revealSpeed: 5,
    showWordOnPause: true,
    animationStyle: 'playful',
    keywordMode: false,
  });

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, []);

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

  const handleRecordingStart = () => {
    setIsRecording(true);
  };

  const handleRecordingStop = async (audioBlob: Blob) => {
    setIsRecording(false);
    setIsProcessing(true);

    // Scroll to results area
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);

    try {
      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('No audio data recorded. Please try again.');
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          if (!base64Audio) {
            throw new Error('Failed to process audio. Please try again.');
          }

          toast({
            title: "Processing...",
            description: "AI is analyzing your practice session",
          });

          // Call the edge function
          const { data, error } = await supabase.functions.invoke('analyze-speech', {
            body: {
              audio: base64Audio,
              originalText: speech!.text_current,
              speechId: speech!.id,
              userTier: subscriptionTier,
            },
          });

          if (error) {
            console.error('Edge function error:', error);
            throw new Error(error.message || 'Failed to analyze speech');
          }

          if (!data) {
            throw new Error('No response from analysis service');
          }

          setSessionResults(data);
          
          // Delay showing results for smooth transition
          setTimeout(() => {
            setIsProcessing(false);
            setShowResults(true);
          }, 500);

          // Save practice session to database
          const { error: sessionError } = await supabase
            .from('practice_sessions')
            .insert({
              speech_id: speech!.id,
              score: data.accuracy,
              missed_words: data.missedWords,
              delayed_words: data.delayedWords,
              duration: 0,
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
        } catch (innerError: any) {
          console.error('Error in analysis:', innerError);
          toast({
            variant: "destructive",
            title: "Analysis failed",
            description: innerError.message || "Failed to analyze your recording. Please try again.",
          });
          setIsProcessing(false);
        }
      };

      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: "Processing failed",
          description: "Failed to read audio file. Please try again.",
        });
        setIsProcessing(false);
      };

    } catch (error: any) {
      console.error('Error processing recording:', error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message || "Failed to process your recording. Please try again.",
      });
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
      <LoadingOverlay isVisible={isProcessing} />
      
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

          {/* Ad Placeholder - Free Users */}
          {subscriptionTier === 'free' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex items-center justify-center py-6">
                <p className="text-sm text-muted-foreground">Ad Space - Upgrade to remove ads</p>
              </CardContent>
            </Card>
          )}

          <PracticeSettings settings={settings} onSettingsChange={setSettings} />

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
                        <div className="text-center mb-4">
                          <p className="text-sm text-muted-foreground">
                            🎤 Speak clearly. Words appear as you say them. Tap to reveal if stuck.
                          </p>
                        </div>
                        <EnhancedWordTracker
                          text={speech.text_current}
                          isRecording={isRecording}
                          language="en-US"
                          revealSpeed={settings.revealSpeed}
                          showWordOnPause={settings.showWordOnPause}
                          animationStyle={settings.animationStyle}
                          keywordMode={settings.keywordMode}
                        />
                      </div>
                    ) : (
                      <div className="prose prose-lg max-w-none">
                        <p className="whitespace-pre-wrap leading-relaxed">
                          {speech.text_current}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <AudioRecorder
                      isRecording={isRecording}
                      onStart={handleRecordingStart}
                      onStop={handleRecordingStop}
                      disabled={isProcessing}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {showResults && sessionResults && (
            <div ref={resultsRef} className="animate-fade-in">
              <PracticeResults
                accuracy={sessionResults.accuracy}
                missedWords={sessionResults.missedWords}
                delayedWords={sessionResults.delayedWords}
                analysis={sessionResults.analysis}
                transcription={sessionResults.transcription}
              />

              {sessionResults.cueText !== speech.text_current && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Updated Cue Script</CardTitle>
                    <CardDescription>
                      Focus on these key words for your next practice
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <p className="text-lg leading-relaxed">
                        {sessionResults.cueText}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">
                      This simplified version will be used in your next practice session.
                    </p>
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
