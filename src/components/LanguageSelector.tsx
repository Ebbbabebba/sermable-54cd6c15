import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const LanguageSelector = ({ value, onChange }: LanguageSelectorProps) => {
  const languages = [
    { code: 'sv-SE', name: 'Swedish', flag: '🇸🇪' },
    { code: 'en-US', name: 'English', flag: '🇺🇸' },
    { code: 'no-NO', name: 'Norwegian', flag: '🇳🇴' },
    { code: 'da-DK', name: 'Danish', flag: '🇩🇰' },
    { code: 'fi-FI', name: 'Finnish', flag: '🇫🇮' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSelector;
