import { useState } from "react";
import { Settings, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type Language = 'sv-SE' | 'no-NO' | 'da-DK' | 'fi-FI' | 'is-IS';
export type AnimationStyle = 'playful' | 'minimal' | 'energetic';

export interface PracticeSettingsConfig {
  language: Language;
  revealSpeed: number; // 1-10 scale
  showWordOnPause: boolean;
  animationStyle: AnimationStyle;
}

interface PracticeSettingsProps {
  settings: PracticeSettingsConfig;
  onSettingsChange: (settings: PracticeSettingsConfig) => void;
}

const languages = [
  { value: 'sv-SE' as Language, label: 'Swedish 🇸🇪', flag: '🇸🇪' },
  { value: 'no-NO' as Language, label: 'Norwegian 🇳🇴', flag: '🇳🇴' },
  { value: 'da-DK' as Language, label: 'Danish 🇩🇰', flag: '🇩🇰' },
  { value: 'fi-FI' as Language, label: 'Finnish 🇫🇮', flag: '🇫🇮' },
  { value: 'is-IS' as Language, label: 'Icelandic 🇮🇸', flag: '🇮🇸' },
];

const animationStyles = [
  { value: 'playful' as AnimationStyle, label: 'Playful', description: 'Bouncy and fun' },
  { value: 'minimal' as AnimationStyle, label: 'Minimal', description: 'Subtle and clean' },
  { value: 'energetic' as AnimationStyle, label: 'Energetic', description: 'Bold and dynamic' },
];

const PracticeSettings = ({ settings, onSettingsChange }: PracticeSettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof PracticeSettingsConfig>(
    key: K,
    value: PracticeSettingsConfig[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Practice Settings</CardTitle>
                  <CardDescription>Customize your learning experience</CardDescription>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Language Selection */}
            <div className="space-y-2">
              <Label htmlFor="language">Language Focus</Label>
              <Select
                value={settings.language}
                onValueChange={(value) => updateSetting('language', value as Language)}
              >
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reveal Speed */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="reveal-speed">Keyword Display Speed</Label>
                <span className="text-sm text-muted-foreground">{settings.revealSpeed}/10</span>
              </div>
              <Slider
                id="reveal-speed"
                min={1}
                max={10}
                step={1}
                value={[settings.revealSpeed]}
                onValueChange={([value]) => updateSetting('revealSpeed', value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Higher = faster word reveal when you pause
              </p>
            </div>

            {/* Show Word on Pause */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-pause">Show Word When Paused</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically reveal the next word if you pause
                </p>
              </div>
              <Switch
                id="show-pause"
                checked={settings.showWordOnPause}
                onCheckedChange={(checked) => updateSetting('showWordOnPause', checked)}
              />
            </div>

            {/* Animation Style */}
            <div className="space-y-2">
              <Label htmlFor="animation">Animation Style</Label>
              <Select
                value={settings.animationStyle}
                onValueChange={(value) => updateSetting('animationStyle', value as AnimationStyle)}
              >
                <SelectTrigger id="animation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {animationStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      <div className="flex flex-col">
                        <span>{style.label}</span>
                        <span className="text-xs text-muted-foreground">{style.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PracticeSettings;
