import { cn } from "@/lib/utils";
import { SPEECH_TYPES } from "./audience/types";

interface SpeechTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SpeechTypeSelector = ({ 
  value, 
  onChange,
  className 
}: SpeechTypeSelectorProps) => {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">What is this speech for?</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SPEECH_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg border transition-all",
              "hover:border-primary/50 hover:bg-accent/50",
              value === type.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card"
            )}
          >
            <span className="text-lg">{type.icon}</span>
            <span className="text-sm font-medium">{type.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        This helps create a realistic practice environment with audience reactions
      </p>
    </div>
  );
};
