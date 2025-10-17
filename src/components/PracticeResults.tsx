import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PracticeResultsProps {
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  fillerWords: { [key: string]: number };
  toneFeedback: string;
  analysis: string;
  transcription: string;
}

const PracticeResults = ({ 
  accuracy, 
  missedWords, 
  delayedWords,
  fillerWords,
  toneFeedback, 
  analysis, 
  transcription 
}: PracticeResultsProps) => {
  const totalFillers = Object.values(fillerWords).reduce((sum, count) => sum + count, 0);
  
  const getEncouragingMessage = () => {
    if (accuracy >= 95) return "🎉 Outstanding performance!";
    if (accuracy >= 80) return "⭐ Great job! Keep it up!";
    if (accuracy >= 60) return "👏 Good effort! You're improving!";
    return "💪 Keep practicing! You're getting better!";
  };

  return (
    <Card className="animate-slide-in-up">
      <CardHeader>
        <div className="space-y-3">
          <div className="text-center py-2 animate-pop-in">
            <p className="text-2xl mb-2">{getEncouragingMessage()}</p>
          </div>
          <CardTitle className="flex items-center gap-2 animate-fade-in">
            Session Results
            <Badge 
              variant={accuracy >= 80 ? "default" : accuracy >= 60 ? "secondary" : "destructive"}
              className="animate-pop-in"
            >
              {accuracy}% Accuracy
            </Badge>
          </CardTitle>
          <CardDescription>AI-powered analysis of your practice session</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2 animate-slide-up">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Performance</span>
            <span className="font-medium">{accuracy}%</span>
          </div>
          <Progress value={accuracy} className="transition-all duration-1000 ease-out" />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg hover-scale animate-pop-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className={cn("h-4 w-4 text-success", accuracy >= 80 && "animate-bounce")} />
              <div className="text-2xl font-bold">
                {Math.round(accuracy)}%
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg hover-scale animate-pop-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className={cn("h-4 w-4 text-warning", delayedWords.length > 0 && "animate-wiggle")} />
              <div className="text-2xl font-bold text-warning">
                {delayedWords.length}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Hesitated</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg hover-scale animate-pop-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className={cn("h-4 w-4 text-destructive", missedWords.length > 0 && "animate-wiggle")} />
              <div className="text-2xl font-bold text-destructive">
                {missedWords.length}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Missed</div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <h4 className="font-semibold">💬 AI Feedback</h4>
          <p className="text-sm text-muted-foreground">{analysis}</p>
        </div>

        {/* Tone Feedback */}
        {toneFeedback && (
          <div className="space-y-2 p-4 bg-primary/5 rounded-lg border border-primary/10">
            <h4 className="font-semibold flex items-center gap-2">
              🎭 Tone & Delivery Feedback
            </h4>
            <p className="text-sm text-muted-foreground">{toneFeedback}</p>
          </div>
        )}

        {/* Filler Words */}
        {totalFillers > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">Filler Words Detected</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(fillerWords).map(([word, count]) => (
                <Badge key={word} variant="outline" className="bg-orange-50 dark:bg-orange-950/30">
                  "{word}" × {count}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Try to eliminate filler words for more confident delivery
            </p>
          </div>
        )}

        {/* Problem Words */}
        {(missedWords.length > 0 || delayedWords.length > 0) && (
          <div className="space-y-3">
            <h4 className="font-semibold">Words to Practice</h4>
            
            {missedWords.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Missed:</p>
                <div className="flex flex-wrap gap-2">
                  {missedWords.map((word, i) => (
                    <Badge key={i} variant="destructive">{word}</Badge>
                  ))}
                </div>
              </div>
            )}

            {delayedWords.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Hesitated:</p>
                <div className="flex flex-wrap gap-2">
                  {delayedWords.map((word, i) => (
                    <Badge key={i} variant="secondary" className="bg-yellow-100 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-300">
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Transcription */}
        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-semibold text-sm">What You Said:</h4>
          <p className="text-sm text-muted-foreground italic">"{transcription}"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PracticeResults;
