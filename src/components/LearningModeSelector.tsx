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
    <div className={cn("s-sy", className)}>
      <label className="s-v9 s-d0">
        {t("upload.learningMode.title")}
      </label>
      <div className="s-e0 s-dp">
        {modes.map((mode) => {
          const active = value === mode.id;
          const Icon = mode.icon;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={cn(
                "s-y7 s-uj s-ot s-p7 s-q9 s-6n s-ws s-c5 s-ib s-dq",
                active
                  ? "s-7n s-5j"
                  : "s-6x s-4b s-hh"
              )}
            >
              <div
                className={cn(
                  "s-r5 s-xg s-fo s-qo s-c5 s-ib s-ig s-ws",
                  active
                    ? "s-5c s-ux"
                    : "s-50 s-ul"
                )}
              >
                <Icon className="s-xv s-g1" />
              </div>
              <div className="s-c6 s-l8">
                <span className="s-d3 s-v9 s-sj s-6i">
                  {mode.label}
                </span>
                <span className="s-vj s-sl s-ul s-ls s-iq s-6i">
                  {mode.description}
                </span>
              </div>
              <div
                className={cn(
                  "s-r5 s-xw s-g2 s-qe s-6n s-c5 s-ib s-ig s-ws",
                  active ? "s-7n s-5c" : "s-6x"
                )}
              >
                {active && (
                  <Check
                    className="s-xq s-fx s-ux"
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
