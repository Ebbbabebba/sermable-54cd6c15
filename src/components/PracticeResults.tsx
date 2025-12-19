import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PracticeResultsProps {
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  analysis: string;
  transcription: string;
  originalText: string;
  currentText: string;
}

const PracticeResults = ({ 
  accuracy, 
  missedWords, 
  delayedWords, 
  analysis, 
  transcription,
  originalText,
  currentText
}: PracticeResultsProps) => {
  const { t } = useTranslation();
  
  const originalWords = originalText.split(/\s+/).filter(word => word.length > 0);
  const currentWords = currentText.split(/\s+/).filter(word => word.length > 0);
  
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
    
    const missedCount = missedWordCount.get(normalized);
    if (missedCount && missedCount > 0) {
      missedWordCount.set(normalized, missedCount - 1);
      return 'missed';
    }
    
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
          {t('practice.results.title')}
          <Badge variant={accuracy >= 80 ? "default" : accuracy >= 60 ? "secondary" : "destructive"}>
            {accuracy}% {t('practice.results.accuracy')}
          </Badge>
        </CardTitle>
        <CardDescription>{t('practice.results.aiAnalysis')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('practice.results.overallPerformance')}</span>
            <span className="font-medium">{accuracy}%</span>
          </div>
          <Progress value={accuracy} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <div className="text-2xl font-bold">{Math.round(accuracy)}%</div>
            </div>
            <div className="text-sm text-muted-foreground">{t('practice.results.correct')}</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">{delayedWords.length}</div>
            </div>
            <div className="text-sm text-muted-foreground">{t('practice.results.hesitated')}</div>
          </div>

          <div className="text-center p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <div className="text-2xl font-bold text-destructive">{missedWords.length}</div>
            </div>
            <div className="text-sm text-muted-foreground">{t('practice.results.missed')}</div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">{t('practice.results.feedback')}</h4>
          <p className="text-sm text-muted-foreground">{analysis}</p>
        </div>

        {(missedWords.length > 0 || delayedWords.length > 0) && (
          <div className="space-y-3">
            <h4 className="font-semibold">{t('practice.results.wordsToPractice')}</h4>
            
            {missedWords.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('practice.results.missedWords')}:</p>
                <div className="flex flex-wrap gap-2">
                  {missedWords.map((word, i) => (
                    <Badge key={i} variant="destructive">{word}</Badge>
                  ))}
                </div>
              </div>
            )}

            {delayedWords.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t('practice.results.delayedWords')}:</p>
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

        <div className="space-y-3 pt-4 border-t">
          <h4 className="font-semibold">{t('practice.results.wordByWord')}</h4>
          <p className="text-xs text-muted-foreground mb-3">{t('practice.results.comparingPerformance')}</p>
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
              <span>{t('practice.results.spokenCorrectly')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500/20 border border-yellow-500/40"></div>
              <span>{t('practice.results.hesitated')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive/40"></div>
              <span>{t('practice.results.missed')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted/40 opacity-60"></div>
              <span>{t('practice.results.hiddenCue')}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-semibold text-sm">{t('practice.results.whatYouSaid')}</h4>
          <p className="text-sm text-muted-foreground italic">"{transcription}"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PracticeResults;