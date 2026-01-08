import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface BeatProgressProps {
  currentBeat: number;
  totalBeats: number;
  currentSentence: number; // 1, 2, or 3
  phase: 'learning' | 'fading' | 'combining';
  repetitionCount: number;
  wordsRemaining?: number;
}

const BeatProgress = ({
  currentBeat,
  totalBeats,
  currentSentence,
  phase,
  repetitionCount,
  wordsRemaining,
}: BeatProgressProps) => {
  const { t } = useTranslation();

  const getPhaseLabel = () => {
    if (phase === 'learning') {
      return t('beat_practice.read_x_of_3', { current: repetitionCount });
    } else if (phase === 'fading') {
      return t('beat_practice.fading_x_left', { count: wordsRemaining || 0 });
    } else {
      return t('beat_practice.combining_sentences');
    }
  };

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Beat indicator */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          {t('beat_practice.beat_x_of_y', { current: currentBeat + 1, total: totalBeats })}
        </span>
        <span className="text-sm font-medium text-primary">
          {phase !== 'combining' && t('beat_practice.sentence_x', { number: currentSentence })}
          {phase === 'combining' && t('beat_practice.combining_sentences')}
        </span>
      </div>

      {/* Beat progress dots */}
      <div className="flex gap-2">
        {Array.from({ length: totalBeats }).map((_, idx) => (
          <div
            key={idx}
            className={cn(
              "h-2 flex-1 rounded-full transition-colors",
              idx < currentBeat
                ? "bg-primary"
                : idx === currentBeat
                ? "bg-primary/50"
                : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Sentence progress within beat */}
      {phase !== 'combining' && (
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((sentenceNum) => (
            <div
              key={sentenceNum}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                sentenceNum < currentSentence
                  ? "bg-primary text-primary-foreground"
                  : sentenceNum === currentSentence
                  ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {sentenceNum < currentSentence && <Check className="h-3 w-3" />}
              <span>S{sentenceNum}</span>
            </div>
          ))}
        </div>
      )}

      {/* Phase label */}
      <div className="text-center">
        <span className={cn(
          "inline-block px-4 py-1.5 rounded-full text-sm font-medium",
          phase === 'learning' && "bg-blue-500/20 text-blue-400",
          phase === 'fading' && "bg-amber-500/20 text-amber-400",
          phase === 'combining' && "bg-purple-500/20 text-purple-400"
        )}>
          {getPhaseLabel()}
        </span>
      </div>
    </div>
  );
};

export default BeatProgress;
