import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type AnimationStyle = 'playful' | 'minimal' | 'energetic';

export interface PracticeSettingsConfig {
  revealSpeed: number;
  showWordOnPause: boolean;
  animationStyle: AnimationStyle;
  keywordMode: boolean;
  hesitationThreshold: number;
  firstWordHesitationThreshold: number;
  sentenceStartDelay: number;
}

interface PracticeSettingsProps {
  settings: PracticeSettingsConfig;
  onSettingsChange: (settings: PracticeSettingsConfig) => void;
}

const PracticeSettings = ({ settings, onSettingsChange }: PracticeSettingsProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const animationStyles = [
    { value: 'playful' as AnimationStyle, label: t('practice.settings.playful'), description: t('practice.settings.playfulDesc') },
    { value: 'minimal' as AnimationStyle, label: t('practice.settings.minimal'), description: t('practice.settings.minimalDesc') },
    { value: 'energetic' as AnimationStyle, label: t('practice.settings.energetic'), description: t('practice.settings.energeticDesc') },
  ];

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
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">{t('practice.settings.title')}</CardTitle>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0 px-4 pb-4">
            {/* Row 1: Sliders */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">{t('practice.settings.keywordDisplaySpeed')}</Label>
                  <span className="text-xs text-muted-foreground">{settings.revealSpeed}/10</span>
                </div>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[settings.revealSpeed]}
                  onValueChange={([value]) => updateSetting('revealSpeed', value)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">{t('practice.settings.supportWordDelay')}</Label>
                  <span className="text-xs text-muted-foreground">{settings.hesitationThreshold}s</span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={0.5}
                  value={[settings.hesitationThreshold]}
                  onValueChange={([value]) => updateSetting('hesitationThreshold', value)}
                />
              </div>
            </div>

            {/* Row 2: More sliders */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">{t('practice.settings.hesitationTime')}</Label>
                  <span className="text-xs text-muted-foreground">{settings.firstWordHesitationThreshold}s</span>
                </div>
                <Slider
                  min={2}
                  max={8}
                  step={0.5}
                  value={[settings.firstWordHesitationThreshold]}
                  onValueChange={([value]) => updateSetting('firstWordHesitationThreshold', value)}
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">{t('practice.settings.sentenceStartDelay')}</Label>
                  <span className="text-xs text-muted-foreground">{settings.sentenceStartDelay}s</span>
                </div>
                <Slider
                  min={2}
                  max={10}
                  step={0.5}
                  value={[settings.sentenceStartDelay]}
                  onValueChange={([value]) => updateSetting('sentenceStartDelay', value)}
                />
              </div>
            </div>

            {/* Row 3: Toggles and select */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-pause"
                  checked={settings.showWordOnPause}
                  onCheckedChange={(checked) => updateSetting('showWordOnPause', checked)}
                />
                <Label htmlFor="show-pause" className="text-xs">{t('practice.settings.showWordWhenPaused')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="keyword-mode"
                  checked={settings.keywordMode}
                  onCheckedChange={(checked) => updateSetting('keywordMode', checked)}
                />
                <Label htmlFor="keyword-mode" className="text-xs">{t('practice.settings.keywordMode')}</Label>
              </div>
              <Select
                value={settings.animationStyle}
                onValueChange={(value) => updateSetting('animationStyle', value as AnimationStyle)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {animationStyles.map((style) => (
                    <SelectItem key={style.value} value={style.value} className="text-xs">
                      {style.label}
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