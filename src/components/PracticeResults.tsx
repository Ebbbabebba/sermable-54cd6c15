import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

interface PracticeResultsProps {
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  analysis: string;
  transcription: string;
}

const PracticeResults = ({ 
  accuracy, 
  missedWords, 
  delayedWords, 
  analysis, 
  transcription 
}: PracticeResultsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Session Results
          <Badge variant={accuracy >= 80 ? "default" : accuracy >= 60 ? "secondary" : "destructive"}>
            {accuracy}% Accuracy
          </Badge>
        </CardTitle>
        <CardDescription>AI-powered analysis of your practice session</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Performance</span>
            <span className="font-medium">{accuracy}%</span>
          </div>
          <Progress value={accuracy} />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div className="text-2xl font-bold">
                {Math.round(accuracy)}%
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Correct</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">
                {delayedWords.length}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Hesitated</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div className="text-2xl font-bold text-destructive">
                {missedWords.length}
              </div>
            </div>
            <div className="text-sm text-muted-foreground">Missed</div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="space-y-2">
          <h4 className="font-semibold">AI Feedback</h4>
          <p className="text-sm text-muted-foreground">{analysis}</p>
        </div>

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
