import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles, Home, Target } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onExit
}: FreestyleSummaryProps) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPerformanceData = () => {
    if (coveragePercent >= 80) return {
      emoji: "🌟",
      title: "Fantastic!",
      subtitle: "You covered it all!",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-600"
    };
    if (coveragePercent >= 60) return {
      emoji: "🎯",
      title: "Well done!",
      subtitle: "Great coverage!",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600"
    };
    return {
      emoji: "📝",
      title: "Good start!",
      subtitle: "Keep practicing!",
      color: "from-orange-500 to-yellow-500",
      bgColor: "bg-orange-500/10",
      textColor: "text-orange-600"
    };
  };

  const performance = getPerformanceData();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5 animate-fade-in">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header with Emoji */}
        <div className="text-center space-y-4">
          <div className="text-8xl animate-bounce">{performance.emoji}</div>
          <h1 className={cn("text-4xl font-bold bg-gradient-to-r bg-clip-text text-transparent", performance.color)}>
            {performance.title}
          </h1>
          <p className="text-lg text-muted-foreground">{performance.subtitle}</p>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center">
          <div className={cn("relative w-40 h-40 rounded-full flex items-center justify-center", performance.bgColor)}>
            <svg className="absolute inset-0 w-40 h-40 -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - coveragePercent / 100)}`}
                className={performance.textColor}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <div className={cn("text-4xl font-bold", performance.textColor)}>{Math.round(coveragePercent)}%</div>
              <div className="text-xs text-muted-foreground">Coverage</div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <Card className={cn("p-4 text-center", performance.bgColor)}>
            <Target className={cn("w-6 h-6 mx-auto mb-2", performance.textColor)} />
            <div className="text-2xl font-bold">{coveredSegments}/{totalSegments}</div>
            <div className="text-xs text-muted-foreground">Segments</div>
          </Card>
          
          <Card className={cn("p-4 text-center", performance.bgColor)}>
            <Sparkles className={cn("w-6 h-6 mx-auto mb-2", performance.textColor)} />
            <div className="text-2xl font-bold">{mentionedCueWords}/{totalCueWords}</div>
            <div className="text-xs text-muted-foreground">Cue Words</div>
          </Card>
          
          <Card className={cn("p-4 text-center", performance.bgColor)}>
            <Clock className={cn("w-6 h-6 mx-auto mb-2", performance.textColor)} />
            <div className="text-2xl font-bold">{formatDuration(duration)}</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </Card>
        </div>

        {/* Missed Cue Words */}
        {missedCueWords.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
              Words to Practice Next Time
            </h3>
            <div className="flex flex-wrap gap-2">
              {missedCueWords.slice(0, 8).map((word, idx) => (
                <Badge key={idx} variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-300">
                  {word}
                </Badge>
              ))}
              {missedCueWords.length > 8 && (
                <Badge variant="secondary" className="bg-muted">
                  +{missedCueWords.length - 8} more
                </Badge>
              )}
            </div>
          </Card>
        )}

        {/* AI Feedback */}
        <Card className={cn("p-6", performance.bgColor)}>
          <div className="flex items-start gap-3">
            <Sparkles className={cn("w-5 h-5 mt-0.5 flex-shrink-0", performance.textColor)} />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
                <p className="text-sm">{feedback.summary}</p>
              </div>
              
              {feedback.advice && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Tip</h4>
                  <p className="text-sm">{feedback.advice}</p>
                </div>
              )}
              
              {feedback.nextStep && (
                <div className={cn("p-3 rounded-lg border", performance.bgColor)}>
                  <h4 className={cn("text-sm font-semibold mb-1", performance.textColor)}>Next Step</h4>
                  <p className="text-sm">{feedback.nextStep}</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Action */}
        <Button
          onClick={onExit}
          size="lg"
          className={cn("w-full bg-gradient-to-r text-white shadow-lg hover:shadow-xl transition-all", performance.color)}
        >
          <Home className="h-5 w-5 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
};
