import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mic, MicOff, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
}

const Practice = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPracticing, setIsPracticing] = useState(false);

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
    toast({
      title: "Practice mode activated",
      description: "Read your speech aloud when ready.",
    });
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      toast({
        title: "Recording stopped",
        description: "Processing your practice session...",
      });
      // Here we would process the audio with AI
    } else {
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone.",
      });
    }
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
      {/* Header */}
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
          {/* Title Section */}
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{speech.title}</h1>
            <p className="text-muted-foreground">
              Practice session • {speech.text_original.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Session Progress</CardTitle>
              <CardDescription>Track your practice performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Memorization</span>
                  <span className="font-medium">0%</span>
                </div>
                <Progress value={0} />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Accuracy</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">0</div>
                  <div className="text-sm text-muted-foreground">Minutes</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Practice Area */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Mode</CardTitle>
              <CardDescription>
                {isPracticing
                  ? "Read the text aloud and we'll track your progress"
                  : "Click start to begin your practice session"}
              </CardDescription>
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
                  {/* Speech Text */}
                  <div className="p-6 bg-muted/30 rounded-lg">
                    <div className="prose prose-lg max-w-none">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {speech.text_current}
                      </p>
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div className="flex justify-center">
                    <Button
                      size="lg"
                      variant={isRecording ? "destructive" : "default"}
                      onClick={handleToggleRecording}
                      className="w-48"
                    >
                      {isRecording ? (
                        <>
                          <MicOff className="h-5 w-5 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="h-5 w-5 mr-2" />
                          Start Recording
                        </>
                      )}
                    </Button>
                  </div>

                  {isRecording && (
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse"></div>
                        Recording in progress...
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Feedback Section (Placeholder) */}
          {isPracticing && (
            <Card>
              <CardHeader>
                <CardTitle>AI Feedback</CardTitle>
                <CardDescription>
                  Real-time analysis of your practice session
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  Complete a recording to receive AI-powered feedback on your performance.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Practice;
