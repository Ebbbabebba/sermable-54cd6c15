import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Sparkles, TrendingUp } from "lucide-react";

interface FreestyleSummaryProps {
  totalSegments: number;
  coveredSegments: number;
  coveragePercent: number;
  totalCueWords: number;
  mentionedCueWords: number;
  missedCueWords: string[];
  duration: number;
  feedback: {
    summary: string;
    coverage: string;
    missedWords: string;
    advice: string;
    nextStep: string;
  };
  onRetry: () => void;
  onExit: () => void;
}

export const FreestyleSummary = ({
  totalSegments,
  coveredSegments,
  coveragePercent,
  totalCueWords,
  mentionedCueWords,
  missedCueWords,
  duration,
  feedback,
  onRetry,
  onExit
}: FreestyleSummaryProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getCoverageColor = () => {
    if (coveragePercent >= 80) return "text-green-600 dark:text-green-400";
    if (coveragePercent >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCoverageBadge = () => {
    if (coveragePercent >= 80) return { label: "Excellent", variant: "default" as const };
    if (coveragePercent >= 60) return { label: "Good", variant: "secondary" as const };
    return { label: "Needs Work", variant: "destructive" as const };
  };

  const badge = getCoverageBadge();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-purple-500/5 to-pink-500/5">
      <Card className="w-full max-w-3xl p-8 space-y-8 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Freestyle Presentation Complete!
          </h2>
          <p className="text-muted-foreground">
            Here's how you did with your natural flow
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center bg-gradient-to-br from-purple-500/10 to-transparent">
            <div className="text-3xl font-bold text-purple-600">{coveragePercent}%</div>
            <div className="text-xs text-muted-foreground mt-1">Coverage</div>
          </Card>
          
          <Card className="p-4 text-center bg-gradient-to-br from-blue-500/10 to-transparent">
            <div className="text-3xl font-bold text-blue-600">{coveredSegments}/{totalSegments}</div>
            <div className="text-xs text-muted-foreground mt-1">Segments</div>
          </Card>
          
          <Card className="p-4 text-center bg-gradient-to-br from-green-500/10 to-transparent">
            <div className="text-3xl font-bold text-green-600">{mentionedCueWords}/{totalCueWords}</div>
            <div className="text-xs text-muted-foreground mt-1">Key Words</div>
          </Card>
          
          <Card className="p-4 text-center bg-gradient-to-br from-orange-500/10 to-transparent">
            <div className="text-3xl font-bold text-orange-600">{formatDuration(duration)}</div>
            <div className="text-xs text-muted-foreground mt-1">Duration</div>
          </Card>
        </div>

        {/* Overall Performance */}
        <Card className="p-6 bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Overall Performance
            </h3>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Segment Coverage</span>
                <span className={getCoverageColor()}>{coveragePercent}%</span>
              </div>
              <div className="h-3 bg-background rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-1000"
                  style={{ width: `${coveragePercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Key Words Mentioned</span>
                <span className={getCoverageColor()}>
                  {Math.round((mentionedCueWords / totalCueWords) * 100)}%
                </span>
              </div>
              <div className="h-3 bg-background rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000"
                  style={{ width: `${(mentionedCueWords / totalCueWords) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Missed Cue Words */}
        {missedCueWords.length > 0 && (
          <Card className="p-6 bg-yellow-500/5 border-yellow-500/20">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <XCircle className="w-5 h-5 text-yellow-600" />
              Key Words to Practice
            </h3>
            <div className="flex flex-wrap gap-2">
              {missedCueWords.map((word, idx) => (
                <Badge key={idx} variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">
                  {word}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* AI Feedback */}
        <Card className="p-6 bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Coach Feedback
          </h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
              <p className="text-sm">{feedback.summary}</p>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Advice</h4>
              <p className="text-sm">{feedback.advice}</p>
            </div>
            
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
              <h4 className="text-sm font-medium text-primary mb-1 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Next Step
              </h4>
              <p className="text-sm">{feedback.nextStep}</p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={onExit}
            variant="outline"
            className="flex-1"
          >
            Back to Dashboard
          </Button>
          <Button
            onClick={onRetry}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Try Again
          </Button>
        </div>
      </Card>
    </div>
  );
};
