import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, Sparkles, Home } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const getPerformanceData = () => {
    if (accuracy >= 90) return {
      emoji: "🎉",
      title: "Amazing!",
      subtitle: "You nailed it!",
      color: "from-green-500 to-emerald-500",
      bgColor: "bg-green-500/10",
      textColor: "text-green-600"
    };
    if (accuracy >= 75) return {
      emoji: "👏",
      title: "Great job!",
      subtitle: "Keep it up!",
      color: "from-blue-500 to-cyan-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-600"
    };
    return {
      emoji: "💪",
      title: "Good effort!",
      subtitle: "Practice makes perfect!",
      color: "from-orange-500 to-yellow-500",
      bgColor: "bg-orange-500/10",
      textColor: "text-orange-600"
    };
  };

  const performance = getPerformanceData();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5 animate-fade-in">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header with Emoji and Score */}
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
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - accuracy / 100)}`}
                className={performance.textColor}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <div className={cn("text-4xl font-bold", performance.textColor)}>{Math.round(accuracy)}%</div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={cn("p-4 text-center", performance.bgColor)}>
            <Clock className={cn("w-6 h-6 mx-auto mb-2", performance.textColor)} />
            <div className="text-2xl font-bold">{minutes > 0 && `${minutes}:`}{seconds.toString().padStart(2, '0')}</div>
            <div className="text-xs text-muted-foreground">Duration</div>
          </Card>
          
          <Card className={cn("p-4 text-center", performance.bgColor)}>
            <AlertCircle className={cn("w-6 h-6 mx-auto mb-2", performance.textColor)} />
            <div className="text-2xl font-bold">{hesitations}</div>
            <div className="text-xs text-muted-foreground">Hesitations</div>
          </Card>
        </div>

        {/* Missed Words */}
        {missedWords.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              Words to Practice
            </h3>
            <div className="flex flex-wrap gap-2">
              {missedWords.slice(0, 10).map((word, idx) => (
                <Badge key={idx} variant="secondary" className="bg-orange-500/10 text-orange-700 dark:text-orange-300">
                  {word}
                </Badge>
              ))}
              {missedWords.length > 10 && (
                <Badge variant="secondary" className="bg-muted">
                  +{missedWords.length - 10} more
                </Badge>
              )}
            </div>
          </Card>
        )}

        {/* AI Feedback */}
        <Card className={cn("p-6", performance.bgColor)}>
          <div className="flex items-start gap-3 mb-4">
            <Sparkles className={cn("w-5 h-5 mt-0.5", performance.textColor)} />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Summary</h4>
                <p className="text-sm">{feedbackSummary}</p>
              </div>
              
              {feedbackAdvice && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Tip</h4>
                  <p className="text-sm">{feedbackAdvice}</p>
                </div>
              )}
              
              {feedbackNextStep && (
                <div className={cn("p-3 rounded-lg border", performance.bgColor)}>
                  <h4 className={cn("text-sm font-semibold mb-1", performance.textColor)}>Next Step</h4>
                  <p className="text-sm">{feedbackNextStep}</p>
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

export default PresentationSummary;
