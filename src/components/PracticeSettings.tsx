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
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{t('practice.settings.title')}</CardTitle>
                  <CardDescription>{t('practice.settings.customize')}</CardDescription>
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
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="reveal-speed">{t('practice.settings.keywordDisplaySpeed')}</Label>
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
              <p className="text-xs text-muted-foreground">{t('practice.settings.fasterReveal')}</p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-pause">{t('practice.settings.showWordWhenPaused')}</Label>
                <p className="text-xs text-muted-foreground">{t('practice.settings.revealNextWord')}</p>
              </div>
              <Switch
                id="show-pause"
                checked={settings.showWordOnPause}
                onCheckedChange={(checked) => updateSetting('showWordOnPause', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="keyword-mode">{t('practice.settings.keywordMode')}</Label>
                <p className="text-xs text-muted-foreground">{t('practice.settings.keywordModeDesc')}</p>
              </div>
              <Switch
                id="keyword-mode"
                checked={settings.keywordMode}
                onCheckedChange={(checked) => updateSetting('keywordMode', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="animation">{t('practice.settings.animationStyle')}</Label>
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

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="hesitation">{t('practice.settings.supportWordDelay')}</Label>
                <span className="text-sm text-muted-foreground">{settings.hesitationThreshold}s</span>
              </div>
              <Slider
                id="hesitation"
                min={1}
                max={5}
                step={0.5}
                value={[settings.hesitationThreshold]}
                onValueChange={([value]) => updateSetting('hesitationThreshold', value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{t('practice.settings.supportWordDelayDesc')}</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="first-hesitation">{t('practice.settings.hesitationTime')}</Label>
                <span className="text-sm text-muted-foreground">{settings.firstWordHesitationThreshold}s</span>
              </div>
              <Slider
                id="first-hesitation"
                min={2}
                max={8}
                step={0.5}
                value={[settings.firstWordHesitationThreshold]}
                onValueChange={([value]) => updateSetting('firstWordHesitationThreshold', value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{t('practice.settings.hesitationTimeDesc')}</p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default PracticeSettings;