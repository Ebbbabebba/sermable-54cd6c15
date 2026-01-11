import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PresentationControlsProps {
  pauseThreshold: number;
  setPauseThreshold: (value: number) => void;
  autoReveal: boolean;
  setAutoReveal: (value: boolean) => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  onClose: () => void;
}

const PresentationControls = ({
  pauseThreshold,
  setPauseThreshold,
  autoReveal,
  setAutoReveal,
  fontSize,
  setFontSize,
  onClose,
}: PresentationControlsProps) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-start justify-center pt-20">
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
          {/* Pause Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pause-threshold">{t('presentation.pauseDetection')}</Label>
              <span className="text-sm text-muted-foreground">
                {(pauseThreshold / 1000).toFixed(1)}s
              </span>
            </div>
            <Slider
              id="pause-threshold"
              min={2000}
              max={8000}
              step={500}
              value={[pauseThreshold]}
              onValueChange={(value) => setPauseThreshold(value[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t('presentation.howLongToWait')}
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

          {/* Instructions */}
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-semibold mb-2">{t('presentation.quickTips')}</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• {t('presentation.tip1')}</li>
              <li>• {t('presentation.tip2')}</li>
              <li>• {t('presentation.tip3')}</li>
              <li>• {t('presentation.tip4')}</li>
              <li>• {t('presentation.tip5')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresentationControls;