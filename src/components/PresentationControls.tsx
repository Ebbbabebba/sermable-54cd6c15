import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PresentationControlsProps {
  hintDelay: number;
  setHintDelay: (value: number) => void;
  sentenceStartDelay: number;
  setSentenceStartDelay: (value: number) => void;
  autoReveal: boolean;
  setAutoReveal: (value: boolean) => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  onClose: () => void;
}

const PresentationControls = ({
  hintDelay,
  setHintDelay,
  sentenceStartDelay,
  setSentenceStartDelay,
  autoReveal,
  setAutoReveal,
  fontSize,
  setFontSize,
  onClose,
}: PresentationControlsProps) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-start justify-center pt-20">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('presentation.settings')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {t('presentation.customizeExperience')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Word Hint Delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hint-delay">Word hint delay</Label>
              <span className="text-sm text-muted-foreground">
                {(hintDelay / 1000).toFixed(1)}s
              </span>
            </div>
            <Slider
              id="hint-delay"
              min={1000}
              max={5000}
              step={500}
              value={[hintDelay]}
              onValueChange={(value) => setHintDelay(value[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              How long before a forgotten word appears
            </p>
          </div>

          {/* Sentence Start Delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sentence-delay">Sentence start delay</Label>
              <span className="text-sm text-muted-foreground">
                {(sentenceStartDelay / 1000).toFixed(1)}s
              </span>
            </div>
            <Slider
              id="sentence-delay"
              min={2000}
              max={8000}
              step={500}
              value={[sentenceStartDelay]}
              onValueChange={(value) => setSentenceStartDelay(value[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Extra time for the first word of a new sentence
            </p>
          </div>

          {/* Auto Reveal */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-reveal">{t('presentation.autoReveal')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('presentation.autoRevealDesc')}
              </p>
            </div>
            <Switch
              id="auto-reveal"
              checked={autoReveal}
              onCheckedChange={setAutoReveal}
            />
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="font-size">{t('presentation.textSize')}</Label>
              <span className="text-sm text-muted-foreground">
                {fontSize}px
              </span>
            </div>
            <Slider
              id="font-size"
              min={20}
              max={56}
              step={2}
              value={[fontSize]}
              onValueChange={(value) => setFontSize(value[0])}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresentationControls;
