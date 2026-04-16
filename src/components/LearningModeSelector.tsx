import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Brain, BookOpen, HelpCircle } from "lucide-react";

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
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  const modes = [
    {
      id: "word_by_word",
      icon: Brain,
      label: t("upload.learningMode.wordByWord"),
      description: t("upload.learningMode.wordByWordDesc"),
      helpText: t("upload.learningMode.wordByWordHelp", "You practice memorizing the exact words of your speech. Words are progressively hidden as you master them, until you can recite the entire text from memory."),
    },
    {
      id: "general_overview",
      icon: BookOpen,
      label: t("upload.learningMode.generalOverview"),
      description: t("upload.learningMode.generalOverviewDesc"),
      helpText: t("upload.learningMode.generalOverviewHelp", "You practice remembering the key topics and structure of your speech. You don't need to memorize exact words — just be able to cover all the main points in your own words."),
    },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">
        {t("upload.learningMode.title")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => (
          <div key={mode.id} className="flex flex-col">
            <button
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
              <div className="flex items-center justify-between w-full">
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
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedHelp(expandedHelp === mode.id ? null : mode.id);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
              <div>
                <span className="text-sm font-semibold block">{mode.label}</span>
                <span className="text-xs text-muted-foreground leading-snug block mt-0.5">
                  {mode.description}
                </span>
              </div>
            </button>
            {expandedHelp === mode.id && (
              <div className="mt-1.5 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground leading-relaxed">
                {mode.helpText}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
