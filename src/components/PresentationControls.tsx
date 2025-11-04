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
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 flex items-start justify-center pt-20">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Presentation Settings</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            Customize your presentation experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pause Threshold */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pause-threshold">Pause Detection</Label>
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
              How long to wait before showing next word
            </p>
          </div>

          {/* Auto Reveal */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-reveal">Auto Reveal</Label>
              <p className="text-xs text-muted-foreground">
                Automatically show next word after pause
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
              <Label htmlFor="font-size">Text Size</Label>
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
            <h4 className="text-sm font-semibold mb-2">Quick Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Toggle Live Mode to start speech tracking</li>
              <li>• Click anywhere to show/hide controls</li>
              <li>• Press ESC to exit presentation</li>
              <li>• Yellow highlight = pause detected</li>
              <li>• Blue highlight = currently speaking</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PresentationControls;
