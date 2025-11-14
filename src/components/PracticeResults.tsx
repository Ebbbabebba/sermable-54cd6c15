import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Clock, X, Frown, Meh, Smile, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface PracticeResultsProps {
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  analysis: string;
  transcription: string;
  originalText: string;
  currentText: string;
  onRatingSubmit?: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
  showRatingButtons?: boolean;
}

const PracticeResults = ({ 
  accuracy, 
  missedWords, 
  delayedWords, 
  analysis, 
  transcription,
  originalText,
  currentText,
  onRatingSubmit,
  showRatingButtons = false
}: PracticeResultsProps) => {
  const [selectedRating, setSelectedRating] = useState<'again' | 'hard' | 'good' | 'easy' | null>(null);
  
  const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    setSelectedRating(rating);
    onRatingSubmit?.(rating);
  };
  // Parse words and determine their status
  const originalWords = originalText.split(/\s+/).filter(word => word.length > 0);
  const currentWords = currentText.split(/\s+/).filter(word => word.length > 0);
  
  // Create a set of words that were hidden in cue text (in original but faded during practice)
  const hiddenCueWords = new Set<string>();
  originalWords.forEach((word, index) => {
    const normalizedWord = word.toLowerCase().replace(/[^\w]/g, '');
    // If word was in original but practice system hid it (mastered), track it
    if (currentWords.some(cw => cw.toLowerCase().replace(/[^\w]/g, '') === normalizedWord)) {
      // Word is in both, might have been temporarily hidden during practice
      // We'll mark these specially in the display
    }
  });
  
  // Count how many times each word appears in missed/delayed arrays
  const missedWordCount = new Map<string, number>();
  const delayedWordCount = new Map<string, number>();
  
  missedWords.forEach(w => {
    const normalized = w.toLowerCase().replace(/[^\w]/g, '');
    missedWordCount.set(normalized, (missedWordCount.get(normalized) || 0) + 1);
  });
  
  delayedWords.forEach(w => {
    const normalized = w.toLowerCase().replace(/[^\w]/g, '');
    delayedWordCount.set(normalized, (delayedWordCount.get(normalized) || 0) + 1);
  });
  
  const getWordStatus = (word: string): 'correct' | 'hesitated' | 'missed' => {
    const normalized = word.toLowerCase().replace(/[^\w]/g, '');
    
    // Check if this instance should be marked as missed
    const missedCount = missedWordCount.get(normalized);
    if (missedCount && missedCount > 0) {
      missedWordCount.set(normalized, missedCount - 1);
      return 'missed';
    }
    
    // Check if this instance should be marked as delayed
    const delayedCount = delayedWordCount.get(normalized);
    if (delayedCount && delayedCount > 0) {
      delayedWordCount.set(normalized, delayedCount - 1);
      return 'hesitated';
    }
    
    return 'correct';
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Session Results
          <Badge variant={accuracy >= 80 ? "default" : accuracy >= 60 ? "secondary" : "destructive"}>
            {accuracy}% Accuracy
          </Badge>
        </CardTitle>
        <CardDescription>
          {showRatingButtons && !selectedRating 
            ? "How well did you recall this speech from memory?" 
            : "AI-powered analysis of your practice session"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SM-2 Rating Buttons */}
        {showRatingButtons && !selectedRating && (
          <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border-2 border-primary/20">
            <h3 className="font-semibold mb-4 text-center text-lg">Rate Your Recall</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRating('again')}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 hover:border-destructive hover:bg-destructive/10 transition-all"
              >
                <X className="h-6 w-6 text-destructive" />
                <div className="text-center">
                  <div className="font-bold text-destructive">Again</div>
                  <div className="text-xs text-muted-foreground mt-1">Couldn't recall</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRating('hard')}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 hover:border-orange-500 hover:bg-orange-500/10 transition-all"
              >
                <Frown className="h-6 w-6 text-orange-500" />
                <div className="text-center">
                  <div className="font-bold text-orange-500">Hard</div>
                  <div className="text-xs text-muted-foreground mt-1">Struggled</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRating('good')}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 hover:border-success hover:bg-success/10 transition-all"
              >
                <Smile className="h-6 w-6 text-success" />
                <div className="text-center">
                  <div className="font-bold text-success">Good</div>
                  <div className="text-xs text-muted-foreground mt-1">Recalled well</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleRating('easy')}
                className="flex flex-col items-center gap-2 h-auto py-4 border-2 hover:border-blue-500 hover:bg-blue-500/10 transition-all"
              >
                <Zap className="h-6 w-6 text-blue-500" />
                <div className="text-center">
                  <div className="font-bold text-blue-500">Easy</div>
                  <div className="text-xs text-muted-foreground mt-1">Instant recall</div>
                </div>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground text-center mt-4">
              Your rating determines when you'll practice this speech next
            </p>
          </div>
        )}
        
        {selectedRating && (
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
            <p className="font-medium">✅ Rating submitted! Schedule updated based on your performance.</p>
          </div>
        )}
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

        {/* Word-by-Word Comparison Analysis */}
        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold">Word-by-Word Analysis</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Comparing your performance with the original script
          </p>
          <div className="bg-muted/20 rounded-lg p-6 leading-relaxed">
            <div className="flex flex-wrap gap-2 items-center justify-center">
              {originalWords.map((word, index) => {
                const status = getWordStatus(word);
                const wasHiddenDuringPractice = !currentWords.some(
                  cw => cw.toLowerCase().replace(/[^\w]/g, '') === word.toLowerCase().replace(/[^\w]/g, '')
                );
                
                return (
                  <span
                    key={index}
                    className={cn(
                      "inline-block px-2.5 py-1 rounded-md font-medium transition-all",
                      status === 'missed' && "bg-destructive/20 text-destructive border border-destructive/40",
                      status === 'hesitated' && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/40",
                      status === 'correct' && !wasHiddenDuringPractice && "bg-success/10 text-success-foreground/80",
                      status === 'correct' && wasHiddenDuringPractice && "bg-muted/40 text-muted-foreground/50 text-sm opacity-60",
                    )}
                    style={{
                      fontSize: wasHiddenDuringPractice && status === 'correct' ? '0.875rem' : '1rem',
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-success/10 border border-success/40"></div>
              <span>Spoken correctly</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/40"></div>
              <span>Hesitated</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/40"></div>
              <span>Missed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/40 opacity-60"></div>
              <span>Hidden cue (mastered)</span>
            </div>
          </div>
        </div>

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
