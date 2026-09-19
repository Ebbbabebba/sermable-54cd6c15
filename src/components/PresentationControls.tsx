import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface PresentationControlsProps {
  hintDelay: number;
  setHintDelay: (value: number) => void;
  sentenceStartDelay: number;
  setSentenceStartDelay: (value: number) => void;
  onClose: () => void;
}

const PresentationControls = ({
  hintDelay,
  setHintDelay,
  sentenceStartDelay,
  setSentenceStartDelay,
  onClose,
}: PresentationControlsProps) => {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-start justify-center pt-20 px-4">
      <Card className="w-full max-w-md shadow-lg rounded-3xl">
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
              <Label htmlFor="hint-delay">{t('presentation.wordHintDelay')}</Label>
              <span className="text-sm text-muted-foreground">
                {(hintDelay / 1000).toFixed(1)}s
              </span>
            </div>
            <Slider
              id="hint-delay"
              min={500}
              max={5000}
              step={250}
              value={[hintDelay]}
              onValueChange={(value) => setHintDelay(value[0])}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              {t('presentation.wordHintDelayDesc')}
            </p>
          </div>

          {/* Sentence Start Delay */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sentence-delay">{t('presentation.sentenceStartDelay')}</Label>
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
              {t('presentation.sentenceStartDelayDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresentationControls;
