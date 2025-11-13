import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Clock, AlertCircle, TrendingUp, RotateCcw, ArrowLeft } from "lucide-react";

interface PresentationSummaryProps {
  accuracy: number;
  duration: number;
  hesitations: number;
  missedWords: string[];
  feedbackSummary: string;
  feedbackAdvice: string;
  feedbackNextStep: string;
  onExit: () => void;
}

const PresentationSummary = ({
  accuracy,
  duration,
  hesitations,
  missedWords,
  feedbackSummary,
  feedbackAdvice,
  feedbackNextStep,
  onExit,
}: PresentationSummaryProps) => {
  const getAccuracyColor = () => {
    if (accuracy >= 90) return "text-success";
    if (accuracy >= 75) return "text-warning";
    return "text-destructive";
  };

  const getAccuracyBadge = () => {
    if (accuracy >= 90) return { label: "Excellent", variant: "default" as const };
    if (accuracy >= 75) return { label: "Good", variant: "secondary" as const };
    return { label: "Needs Work", variant: "destructive" as const };
  };

  const badge = getAccuracyBadge();
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  return (
    <div className="min-h-screen bg-background p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="text-6xl animate-bounce">🎉</div>
          <h1 className="text-4xl font-bold">Great Work!</h1>
          <p className="text-xl text-muted-foreground">Here's how you did</p>
        </div>

        {/* Main Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Performance Summary</CardTitle>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Accuracy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Accuracy</span>
                </div>
                <span className={`text-2xl font-bold ${getAccuracyColor()}`}>
                  {accuracy.toFixed(1)}%
                </span>
              </div>
              <Progress value={accuracy} className="h-3" />
            </div>

            {/* Duration */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-semibold">Duration</span>
              </div>
              <span className="text-lg">
                {minutes > 0 && `${minutes}m `}{seconds}s
              </span>
            </div>

            {/* Hesitations */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                <span className="font-semibold">Hesitations</span>
              </div>
              <span className="text-lg">{hesitations}</span>
            </div>

            {/* Missed Words */}
            {missedWords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-destructive" />
                  <span className="font-semibold">Missed Words ({missedWords.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missedWords.slice(0, 10).map((word, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                  {missedWords.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{missedWords.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feedback */}
        <Card>
          <CardHeader>
            <CardTitle>Coach's Feedback</CardTitle>
            <CardDescription>Personalized suggestions for improvement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <p className="text-muted-foreground">{feedbackSummary}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Advice</h4>
              <p className="text-muted-foreground whitespace-pre-line">{feedbackAdvice}</p>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Next Step
              </h4>
              <p className="text-sm">{feedbackNextStep}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Button
          variant="outline"
          onClick={onExit}
          className="w-full"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default PresentationSummary;
