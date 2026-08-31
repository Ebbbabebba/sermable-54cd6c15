import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Brain, BookOpen, Check } from "lucide-react";

interface LearningModeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Clean two-card learning mode picker (same visual language as the
 * create-flow Choice cards): one icon, one label, one description line.
 */
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
      <div className="grid gap-3">
        {modes.map((mode) => {
          const active = value === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                "w-full text-left px-5 py-4 rounded-2xl border-2 transition-colors flex items-center gap-4",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <div
                className={cn(
                  "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm sm:text-base block">
                  {mode.label}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-snug block">
                  {mode.description}
                </span>
              </div>
              <div
                className={cn(
                  "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                  active ? "border-primary bg-primary" : "border-border"
                )}
              >
                {active && (
                  <Check
                    className="w-3.5 h-3.5 text-primary-foreground"
                    strokeWidth={3.5}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
