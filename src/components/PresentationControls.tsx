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
    <div className="s-c4 s-i5 s-40 s-3h s-yk s-c5 s-id s-ig s-oa s-os">
      <Card className="s-y7 s-jq s-qx s-qa">
        <CardHeader>
          <div className="s-c5 s-ib s-if">
            <CardTitle>{t('presentation.settings')}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="s-fz s-xt" />
            </Button>
          </div>
          <CardDescription>
            {t('presentation.customizeExperience')}
          </CardDescription>
        </CardHeader>
        <CardContent className="s-t3">
          {/* Word Hint Delay */}
          <div className="s-sy">
            <div className="s-c5 s-ib s-if">
              <Label htmlFor="hint-delay">{t('presentation.wordHintDelay')}</Label>
              <span className="s-v9 s-ul">
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
              className="s-y7"
            />
            <p className="s-vj s-ul">
              {t('presentation.wordHintDelayDesc')}
            </p>
          </div>

          {/* Sentence Start Delay */}
          <div className="s-sy">
            <div className="s-c5 s-ib s-if">
              <Label htmlFor="sentence-delay">{t('presentation.sentenceStartDelay')}</Label>
              <span className="s-v9 s-ul">
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
              className="s-y7"
            />
            <p className="s-vj s-ul">
              {t('presentation.sentenceStartDelayDesc')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresentationControls;
