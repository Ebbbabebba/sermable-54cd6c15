
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Ear, MonitorPlay } from "lucide-react";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'listen' | 'overview') => void;
}

export const PresentationModeSelector = ({
  onSelectMode,
}: PresentationModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="h-screen flex items-start md:items-center justify-center px-4 pb-6 pt-28 md:pt-8 bg-gradient-to-br from-background via-background to-primary/5 overflow-y-auto">
        <div className="w-full max-w-5xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t('presentationMode.chooseMode')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('presentationMode.selectHow')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Whole Speech Mode (formerly Strict Mode) */}
            <Card
              className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group"
              onClick={() => onSelectMode('strict')}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Brain className="w-6 h-6 text-primary" />
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-1">
                    {t('presentationMode.wholeSpeechMode', 'Whole Speech Mode')}
                  </h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.wholeSpeechModeDesc', 'Memorize word for word with hints')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.progressiveHints')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.wordByWord')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm" variant="default">
                  {t('presentationMode.selectWholeSpeech', 'Select Whole Speech')}
                </Button>
              </div>
            </Card>

            {/* Listen Mode (new) */}
            <Card
              className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
              onClick={() => onSelectMode('listen')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ear className="w-6 h-6 text-primary" />
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-1">
                    {t('presentationMode.listenMode', 'Listen Mode')}
                  </h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.listenModeDesc', 'Speak freely. Pause 2s to see the next words.')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.noFollowAlong', 'No follow-along — empty screen')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.hintOnPause', 'Reveals words when you hesitate')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm" variant="default">
                  {t('presentationMode.selectListen', 'Select Listen Mode')}
                </Button>
              </div>
            </Card>

            {/* Script Mode */}
            <Card
              className="p-5 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 cursor-pointer group relative overflow-hidden"
              onClick={() => onSelectMode('overview')}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-4 relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MonitorPlay className="w-6 h-6 text-primary" />
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-1">{t('presentationMode.scriptMode', 'Script Mode')}</h3>
                  <p className="text-muted-foreground text-xs mb-3">
                    {t('presentationMode.scriptModeDesc', 'Read beats, then retell from a reference word')}
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.referenceWordAnchors', 'Reference word anchors')}</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5 font-bold">•</span>
                    <span>{t('presentationMode.retellFromMemory', 'Retell from memory')}</span>
                  </li>
                </ul>

                <Button className="w-full mt-3" size="sm" variant="default">
                  {t('presentationMode.selectScript', 'Select Script')}
                </Button>
              </div>
            </Card>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            {t('presentationMode.switchModes')}
          </p>
        </div>
      </div>
    </>
  );
};
