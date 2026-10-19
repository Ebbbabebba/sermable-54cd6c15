import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { stripPropCueMarkers } from "@/utils/propCues";
import { stripStageDirections } from "@/utils/stageDirections";

interface PracticeResultsProps {
  accuracy: number;
  missedWords: string[];
  delayedWords: string[];
  analysis: string;
  transcription: string;
  originalText: string;
  currentText: string;
  missedIndices?: number[];
  hesitatedIndices?: number[];
}

const PracticeResults = ({ 
  accuracy, 
  missedWords, 
  delayedWords, 
  analysis, 
  transcription,
  originalText,
  currentText,
  missedIndices,
  hesitatedIndices,
}: PracticeResultsProps) => {
  const { t } = useTranslation();

  const originalWords = stripStageDirections(stripPropCueMarkers(originalText)).split(/\s+/).filter((word) => word.length > 0);

  // Prefer index-based hidden detection (brackets in currentText) to avoid issues with repeated words
  const extractHiddenIndices = (text: string): Set<number> => {
    const hidden = new Set<number>();
    let globalWordIndex = 0;
    const parts = stripPropCueMarkers(text).split(/(\[[^\]]*\])/);

    for (const part of parts) {
      if (part.startsWith('[') && part.endsWith(']')) {
        const bracketContent = part.slice(1, -1);
        const wordsInBracket = bracketContent.split(/\s+/).filter((w) => w.trim());
        for (let i = 0; i < wordsInBracket.length; i++) {
          hidden.add(globalWordIndex + i);
        }
        globalWordIndex += wordsInBracket.length;
      } else {
        const visibleWords = part.split(/\s+/).filter((w) => w.trim());
        globalWordIndex += visibleWords.length;
      }
    }

    return hidden;
  };

  const hiddenIndices = extractHiddenIndices(currentText || "");

  const useIndexBased = (missedIndices?.length || 0) > 0 || (hesitatedIndices?.length || 0) > 0;
  const missedIndexSet = new Set(missedIndices || []);
  const hesitatedIndexSet = new Set(hesitatedIndices || []);

  const missedTotal = useIndexBased ? missedIndexSet.size : missedWords.length;
  const hesitatedTotal = useIndexBased ? hesitatedIndexSet.size : delayedWords.length;

  // Fallback: word-count based mapping (can be inaccurate with repeated words)
  const missedWordCount = new Map<string, number>();
  const delayedWordCount = new Map<string, number>();

  if (!useIndexBased) {
    missedWords.forEach((w) => {
      const normalized = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      missedWordCount.set(normalized, (missedWordCount.get(normalized) || 0) + 1);
    });

    delayedWords.forEach((w) => {
      const normalized = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      delayedWordCount.set(normalized, (delayedWordCount.get(normalized) || 0) + 1);
    });
  }

  const getWordStatus = (word: string, index: number): "correct" | "hesitated" | "missed" => {
    if (useIndexBased) {
      if (missedIndexSet.has(index)) return "missed";
      if (hesitatedIndexSet.has(index)) return "hesitated";
      return "correct";
    }

    const normalized = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

    const missedCount = missedWordCount.get(normalized);
    if (missedCount && missedCount > 0) {
      missedWordCount.set(normalized, missedCount - 1);
      return "missed";
    }

    const delayedCount = delayedWordCount.get(normalized);
    if (delayedCount && delayedCount > 0) {
      delayedWordCount.set(normalized, delayedCount - 1);
      return "hesitated";
    }

    return "correct";
  };

  return (
    <Card className="feedback-card">
      <CardHeader>
        <CardTitle className="s-c5 s-ib s-dn">
          {t('practice.results.title')}
          <Badge variant={accuracy >= 80 ? "default" : accuracy >= 60 ? "secondary" : "destructive"}>
            {Number(accuracy.toFixed(0))}% {t('practice.results.accuracy')}
          </Badge>
        </CardTitle>
        <CardDescription>{t('practice.results.aiAnalysis')}</CardDescription>
      </CardHeader>
      <CardContent className="s-t3">
        <div className="s-sy">
          <div className="s-c5 s-if s-v9">
            <span className="s-ul">{t('practice.results.overallPerformance')}</span>
            <span className="s-d0">{Number(accuracy.toFixed(0))}%</span>
          </div>
          <Progress value={accuracy} />
        </div>

        <div className="s-e0 s-e3 s-dq">
          <div className="s-u0 s-mw s-54 s-qh">
            <div className="s-c5 s-ib s-ig s-dn s-jw">
              <CheckCircle2 className="s-fz s-xt s-va" />
              <div className="s-t9 s-cx">{Math.round(accuracy)}%</div>
            </div>
            <div className="s-v9 s-ul">{t('practice.results.correct')}</div>
          </div>

          <div className="s-u0 s-mw s-54 s-qh">
            <div className="s-c5 s-ib s-ig s-dn s-jw">
              <Clock className="s-fz s-xt s-vl" />
              <div className="s-t9 s-cx s-vl">{hesitatedTotal}</div>
            </div>
            <div className="s-v9 s-ul">{t('practice.results.hesitated')}</div>
          </div>

          <div className="s-u0 s-mw s-54 s-qh">
            <div className="s-c5 s-ib s-ig s-dn s-jw">
              <AlertCircle className="s-fz s-xt s-u2" />
              <div className="s-t9 s-cx s-u2">{missedTotal}</div>
            </div>
            <div className="s-v9 s-ul">{t('practice.results.missed')}</div>
          </div>
        </div>

        <div className="s-sy">
          <h4 className="s-d3">{t('practice.results.feedback')}</h4>
          <p className="s-v9 s-ul">{analysis}</p>
        </div>

        {(missedWords.length > 0 || delayedWords.length > 0) && (
          <div className="s-t0">
            <h4 className="s-d3">{t('practice.results.wordsToPractice')}</h4>
            
            {missedWords.length > 0 && (
              <div>
                <p className="s-v9 s-ul s-jy">{t('practice.results.missedWords')}:</p>
                <div className="s-c5 s-cb s-dn">
                  {missedWords.map((word, i) => (
                    <Badge key={i} variant="destructive">{word}</Badge>
                  ))}
                </div>
              </div>
            )}

            {delayedWords.length > 0 && (
              <div>
                <p className="s-v9 s-ul s-jy">{t('practice.results.delayedWords')}:</p>
                <div className="s-c5 s-cb s-dn">
                  {delayedWords.map((word, i) => (
                    <Badge key={i} variant="secondary" className="s-6a s-vo s-8n s-8x">
                      {word}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="s-t0 s-od s-82">
          <h4 className="s-d3">{t('practice.results.wordByWord')}</h4>
          <p className="s-vj s-ul s-jz">{t('practice.results.comparingPerformance')}</p>
          <div className="s-53 s-qh s-my s-ip">
            <div className="s-c5 s-cb s-dn s-ib s-ig">
              {originalWords.map((word, index) => {
                const status = getWordStatus(word, index);
                const wasHiddenDuringPractice = hiddenIndices.has(index);
                
                return (
                  <span
                    key={index}
                    className={cn(
                      "s-i3 s-oq s-oy s-qi s-d0 s-wr",
                      status === 'missed' && "s-4k s-u2 s-6l s-78",
                      status === 'hesitated' && "s-6f s-vm s-8y s-6l s-88",
                      status === 'correct' && !wasHiddenDuringPractice && "s-60 s-vc",
                      status === 'correct' && wasHiddenDuringPractice && "s-55 s-un s-v9 s-mh",
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
          <div className="s-c5 s-cb s-dq s-vj s-ul s-lx">
            <div className="s-c5 s-ib s-dn">
              <div className="s-xt s-fz s-q8 s-60 s-6l s-81"></div>
              <span>{t('practice.results.spokenCorrectly')}</span>
            </div>
            <div className="s-c5 s-ib s-dn">
              <div className="s-xt s-fz s-q8 s-6f s-6l s-88"></div>
              <span>{t('practice.results.hesitated')}</span>
            </div>
            <div className="s-c5 s-ib s-dn">
              <div className="s-xt s-fz s-q8 s-4k s-6l s-78"></div>
              <span>{t('practice.results.missed')}</span>
            </div>
            <div className="s-c5 s-ib s-dn">
              <div className="s-xt s-fz s-q8 s-55 s-mh"></div>
              <span>{t('practice.results.hiddenCue')}</span>
            </div>
          </div>
        </div>

        <div className="s-sy s-od s-82">
          <h4 className="s-d3 s-v9">{t('practice.results.whatYouSaid')}</h4>
          <p className="s-v9 s-ul italic">"{transcription}"</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PracticeResults;