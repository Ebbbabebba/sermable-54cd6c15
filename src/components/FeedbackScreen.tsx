import { useEffect, useState } from "react";
import { CheckCircle2, Star, Sparkles, Trophy, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackScreenProps {
  accuracy: number;
  onComplete?: () => void;
}

const FeedbackScreen = ({ accuracy, onComplete }: FeedbackScreenProps) => {
  const [showContent, setShowContent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Trigger animations
    setTimeout(() => setShowContent(true), 100);
    
    // Show confetti for good performance
    if (accuracy >= 80) {
      setTimeout(() => setShowConfetti(true), 300);
      setTimeout(() => setShowConfetti(false), 3000);
    }

    // Auto-dismiss
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [accuracy, onComplete]);

  const getMessage = () => {
    if (accuracy >= 95) return { text: "Perfect!", emoji: "🎉", color: "text-success", icon: Trophy };
    if (accuracy >= 80) return { text: "Excellent!", emoji: "⭐", color: "text-success", icon: Star };
    if (accuracy >= 60) return { text: "Good job!", emoji: "👏", color: "text-primary", icon: Target };
    return { text: "Keep practicing!", emoji: "💪", color: "text-warning", icon: Sparkles };
  };

  const message = getMessage();
  const Icon = message.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      {/* Confetti */}
      {showConfetti && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 0.5}s`,
                background: `hsl(${Math.random() * 360}, 70%, 60%)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div
        className={cn(
          "text-center space-y-6 transform transition-all duration-500",
          showContent ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        {/* Icon with animation */}
        <div className="flex justify-center">
          <div
            className={cn(
              "p-6 rounded-full bg-gradient-to-br inline-block",
              accuracy >= 80 
                ? "from-success/20 to-success/5 animate-tada" 
                : "from-primary/20 to-primary/5 animate-pop-in"
            )}
          >
            <Icon
              className={cn(
                "h-20 w-20",
                message.color,
                accuracy >= 80 && "animate-celebrate"
              )}
            />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2 animate-slide-in-up">
          <h2 className="text-5xl font-bold">
            {message.emoji}
          </h2>
          <h1 className={cn("text-4xl font-bold", message.color)}>
            {message.text}
          </h1>
          <div className="text-6xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent animate-pop-in">
            {accuracy}%
          </div>
        </div>

        {/* Progress dots animation */}
        <div className="flex justify-center gap-2 animate-fade-in">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedbackScreen;
