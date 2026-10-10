import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface SpeechTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const SPEECH_TYPE_OPTIONS = [
  { value: 'office_meeting' },
  { value: 'school_presentation' },
  { value: 'conference' },
  { value: 'wedding' },
  { value: 'interview' },
  { value: 'general' },
];

export const SpeechTypeSelector = ({ 
  value, 
  onChange,
  className 
}: SpeechTypeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className={cn("s-sy", className)}>
      <label className="s-v9 s-d0">{t('upload.speechType.label')}</label>
      <div className="s-e0 s-e2 s-rm s-dn">
        {SPEECH_TYPE_OPTIONS.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => onChange(type.value)}
            className={cn(
              "s-c5 s-ib s-dn s-mv s-qh s-6l s-wr",
              "s-hi s-gr",
              value === type.value
                ? "s-7n s-5e s-uw"
                : "s-6x s-4b"
            )}
          >
            <span className="s-v9 s-d0">{t(`upload.speechType.${type.value}`)}</span>
          </button>
        ))}
      </div>
      <p className="s-vj s-ul s-lt">
        {t('upload.speechType.hint')}
      </p>
    </div>
  );
};
