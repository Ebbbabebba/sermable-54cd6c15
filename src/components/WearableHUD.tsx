import { cn } from "@/lib/utils";
import { CircularProgress } from "./CircularProgress";
import { Volume2, Circle, Square, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ViewMode = 'full' | 'compact' | 'wearable';

interface WearableHUDProps {
  viewMode: ViewMode;
  progress: number;
  currentWord: number;
  totalWords: number;
  nextKeyword?: string;
  isRecording: boolean;
  isListening: boolean;
  status: 'idle' | 'speaking' | 'silence' | 'error' | 'success';
  onToggleRecording: () => void;
  elapsedTime?: number;
  className?: string;
}

export const WearableHUD = ({
  viewMode,
  progress,
  currentWord,
  totalWords,
  nextKeyword,
  isRecording,
  isListening,
  status,
  onToggleRecording,
  elapsedTime = 0,
  className,
}: WearableHUDProps) => {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const statusColors = {
    idle: 'text-muted-foreground',
    speaking: 'text-primary',
    silence: 'text-yellow-500',
    error: 'text-destructive',
    success: 'text-green-500',
  };

  const statusBgColors = {
    idle: 'bg-muted/50',
    speaking: 'bg-primary/20',
    silence: 'bg-yellow-500/20',
    error: 'bg-destructive/20',
    success: 'bg-green-500/20',
  };

  // Wearable mode - ultra minimal for watches/glasses
  if (viewMode === 'wearable') {
    return (
      <div className={cn(
        "fixed inset-0 flex flex-col items-center justify-center p-4",
        "bg-background/95 backdrop-blur-sm",
        className
      )}>
        {/* Circular Progress - Main focus */}
        <CircularProgress
          value={progress}
          size={140}
          strokeWidth={10}
          showValue
          valueFormat="percent"
          className="mb-4"
          progressColor={status === 'error' ? 'hsl(var(--destructive))' : 
                        status === 'success' ? 'hsl(142.1 76.2% 36.3%)' : 
                        'hsl(var(--primary))'}
        />

        {/* Next keyword - large and readable */}
        <AnimatePresence mode="wait">
          {nextKeyword && (
            <motion.div
              key={nextKeyword}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mb-4"
            >
              <span className="text-xl font-bold truncate max-w-[180px] block">
                {nextKeyword}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status indicator dots */}
        <div className="flex gap-2 mb-6">
          {[0, 1, 2].map((i) => {
            const segmentProgress = (currentWord / totalWords) * 3;
            const isComplete = segmentProgress > i + 1;
            const isCurrent = segmentProgress > i && segmentProgress <= i + 1;
            
            return (
              <div
                key={i}
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-300",
                  isComplete && "bg-green-500",
                  isCurrent && "bg-primary animate-pulse",
                  !isComplete && !isCurrent && "bg-muted"
                )}
              />
            );
          })}
        </div>

        {/* Giant touch target for start/stop */}
        <button
          onClick={onToggleRecording}
          className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            "transition-all duration-200 active:scale-95",
            "shadow-lg",
            isRecording 
              ? "bg-destructive text-destructive-foreground" 
              : "bg-primary text-primary-foreground"
          )}
        >
          {isRecording ? (
            <Square className="w-8 h-8" />
          ) : (
            <Circle className="w-8 h-8 fill-current" />
          )}
        </button>
      </div>
    );
  }

  // Compact mode - minimal HUD overlay
  if (viewMode === 'compact') {
    return (
      <div className={cn(
        "fixed inset-0 flex flex-col items-center justify-center p-6",
        "bg-background",
        className
      )}>
        {/* Top status bar */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-full",
            "bg-background/95 backdrop-blur-sm border border-border shadow-md"
          )}>
            {isRecording && (
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            )}
            <span className="text-sm font-mono">{timeDisplay}</span>
            <span className="text-xs text-muted-foreground">
              {currentWord}/{totalWords}
            </span>
          </div>
        </div>

        {/* Center content */}
        <div className="flex flex-col items-center gap-6">
          {/* Progress ring with status */}
          <div className="relative">
            <CircularProgress
              value={progress}
              size={160}
              strokeWidth={8}
              showValue
              valueFormat="percent"
              progressColor={status === 'error' ? 'hsl(var(--destructive))' : 
                            status === 'success' ? 'hsl(142.1 76.2% 36.3%)' : 
                            'hsl(var(--primary))'}
            />
            
            {/* Listening pulse indicator */}
            {isRecording && isListening && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary"
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </div>

          {/* Status icon */}
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center",
            statusBgColors[status]
          )}>
            {status === 'speaking' && (
              <Volume2 className={cn("w-8 h-8", statusColors[status])} />
            )}
            {status === 'silence' && (
              <AlertCircle className={cn("w-8 h-8", statusColors[status])} />
            )}
            {status === 'success' && (
              <Check className={cn("w-8 h-8", statusColors[status])} />
            )}
            {(status === 'idle' || status === 'error') && (
              <Circle className={cn("w-8 h-8 fill-current", statusColors[status])} />
            )}
          </div>

          {/* Next keyword */}
          <AnimatePresence mode="wait">
            {nextKeyword && (
              <motion.div
                key={nextKeyword}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  "px-6 py-3 rounded-xl text-center",
                  statusBgColors[status]
                )}
              >
                <span className="text-2xl font-semibold">{nextKeyword}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom control */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <button
            onClick={onToggleRecording}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center",
              "transition-all duration-200 active:scale-95 shadow-lg",
              isRecording 
                ? "bg-destructive text-destructive-foreground" 
                : "bg-primary text-primary-foreground"
            )}
          >
            {isRecording ? (
              <Square className="w-6 h-6" />
            ) : (
              <Circle className="w-6 h-6 fill-current" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // Full mode - returns null, use the original StrictPresentationView
  return null;
};
