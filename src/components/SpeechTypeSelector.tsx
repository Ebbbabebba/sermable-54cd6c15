import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SpeechTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SPEECH_TYPE_OPTIONS = [
  { value: 'office_meeting', icon: '💼' },
  { value: 'school_presentation', icon: '🎓' },
  { value: 'conference', icon: '🎤' },
  { value: 'wedding', icon: '💒' },
  { value: 'interview', icon: '🤝' },
  { value: 'general', icon: '📝' },
];

export const SpeechTypeSelector = ({ 
  value, 
  onChange,
  className 
}: SpeechTypeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">{t('upload.speechType.label')}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SPEECH_TYPE_OPTIONS.map((type) => (
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
            <span className="text-sm font-medium">{t(`upload.speechType.${type.value}`)}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {t('upload.speechType.hint')}
      </p>
    </div>
  );
};
