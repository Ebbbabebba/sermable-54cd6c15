import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RotateCcw, ThumbsDown, ThumbsUp, Sparkles } from "lucide-react";

export type AnkiRatingValue = 'again' | 'hard' | 'good' | 'easy';

interface RatingOption {
  value: AnkiRatingValue;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  interval?: string;
}

interface AnkiRatingProps {
  onRate: (rating: AnkiRatingValue) => void;
  isSubmitting?: boolean;
  currentState?: 'new' | 'learning' | 'review' | 'relearning';
  currentInterval?: number; // in minutes
  easeFactor?: number;
}

const calculateNextIntervals = (
  currentState: string = 'new',
  currentInterval: number = 0,
  easeFactor: number = 2.5
): Record<AnkiRatingValue, string> => {
  // SM-2 Anki-style interval calculation
  const learningSteps = [1, 10]; // minutes
  const graduatingInterval = 1440; // 1 day in minutes
  const easyInterval = 4 * 1440; // 4 days in minutes
  
  if (currentState === 'new' || currentState === 'learning') {
    return {
      again: '1 min',
      hard: '6 min',
      good: '10 min',
      easy: '4 days'
    };
  }
  
  if (currentState === 'relearning') {
    return {
      again: '1 min',
      hard: '10 min', 
      good: formatInterval(graduatingInterval),
      easy: formatInterval(graduatingInterval * 1.5)
    };
  }
  
  // Review state - apply SM-2 algorithm
  const hardInterval = Math.max(currentInterval * 1.2, currentInterval + 1440);
  const goodInterval = currentInterval * easeFactor;
  const easyInterval2 = currentInterval * easeFactor * 1.3;
  
  return {
    again: '10 min',
    hard: formatInterval(hardInterval),
    good: formatInterval(goodInterval),
    easy: formatInterval(easyInterval2)
  };
};

const formatInterval = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  const days = minutes / 1440;
  if (days < 30) return `${Math.round(days)} day${Math.round(days) !== 1 ? 's' : ''}`;
  const months = days / 30;
  return `${months.toFixed(1)} mo`;
};

const AnkiRating = ({ 
  onRate, 
  isSubmitting = false,
  currentState = 'new',
  currentInterval = 0,
  easeFactor = 2.5
}: AnkiRatingProps) => {
  const intervals = calculateNextIntervals(currentState, currentInterval, easeFactor);
  
  const ratingOptions: RatingOption[] = [
    {
      value: 'again',
      label: 'Again',
      description: 'Completely forgot',
      icon: <RotateCcw className="h-5 w-5" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10 hover:bg-red-500/20',
      borderColor: 'border-red-500/30',
      interval: intervals.again
    },
    {
      value: 'hard',
      label: 'Hard',
      description: 'Struggled to recall',
      icon: <ThumbsDown className="h-5 w-5" />,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      interval: intervals.hard
    },
    {
      value: 'good',
      label: 'Good',
      description: 'Recalled with effort',
      icon: <ThumbsUp className="h-5 w-5" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10 hover:bg-green-500/20',
      borderColor: 'border-green-500/30',
      interval: intervals.good
    },
    {
      value: 'easy',
      label: 'Easy',
      description: 'Perfect recall',
      icon: <Sparkles className="h-5 w-5" />,
      color: 'text-cosmic-blue dark:text-cosmic-teal',
      bgColor: 'bg-cosmic-blue/10 hover:bg-cosmic-blue/20',
      borderColor: 'border-cosmic-blue/30',
      interval: intervals.easy
    }
  ];

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">How well did you remember?</CardTitle>
        <CardDescription>
          Rate your recall to optimize your learning schedule
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ratingOptions.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onRate(option.value)}
              className={cn(
                "h-auto flex-col py-4 px-3 gap-2 transition-all duration-200",
                "border-2",
                option.bgColor,
                option.borderColor,
                option.color,
                "hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <div className="flex items-center gap-2">
                {option.icon}
                <span className="font-semibold">{option.label}</span>
              </div>
              <span className="text-xs opacity-70 font-normal">
                {option.description}
              </span>
              <span className={cn(
                "text-sm font-medium mt-1 px-2 py-0.5 rounded-full",
                "bg-background/50"
              )}>
                {option.interval}
              </span>
            </Button>
          ))}
        </div>
        
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Honest ratings help the algorithm optimize your practice schedule
        </p>
      </CardContent>
    </Card>
  );
};

export default AnkiRating;
