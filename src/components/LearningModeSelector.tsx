import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Brain, BookOpen } from "lucide-react";

interface LearningModeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const LearningModeSelector = ({
  value,
  onChange,
  className,
}: LearningModeSelectorProps) => {
  const { t } = useTranslation();

  const modes = [
    {
      id: "word_by_word",
      icon: Brain,
      label: t("upload.learningMode.wordByWord"),
      description: t("upload.learningMode.wordByWordDesc"),
    },
    {
      id: "general_overview",
      icon: BookOpen,
      label: t("upload.learningMode.generalOverview"),
      description: t("upload.learningMode.generalOverviewDesc"),
    },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">
        {t("upload.learningMode.title")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={cn(
              "flex flex-col items-start gap-2 p-4 rounded-xl border transition-all text-left",
              "hover:border-primary/50 hover:bg-accent/50",
              value === mode.id
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-card"
            )}
          >
            <div
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                value === mode.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <mode.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="text-sm font-semibold block">{mode.label}</span>
              <span className="text-xs text-muted-foreground leading-snug block mt-0.5">
                {mode.description}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
