import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonitorPlay, BookOpen } from "lucide-react";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'overview') => void;
}

export const PresentationModeSelector = ({
  onSelectMode,
}: PresentationModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className="h-screen flex items-start md:items-center justify-center px-4 pb-6 pt-28 md:pt-8 bg-gradient-to-br from-background via-background to-primary/5 overflow-y-auto">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('presentationMode.chooseMode')}
          </h1>
          <p className="text-muted-foreground">
            {t('presentationMode.selectHow')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Whole Speech Mode */}
          <Card
            className="p-5 rounded-3xl border-2 border-primary/40 hover:border-primary transition-all duration-200 cursor-pointer"
            onClick={() => onSelectMode('strict')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <MonitorPlay className="h-5 w-5 text-primary" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {t('presentationMode.recommended', 'Recommended')}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-1">
                  {t('presentationMode.wholeSpeechMode', 'Whole Speech Mode')}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t('presentationMode.wholeSpeechModeDescV2', 'Run the whole speech from start to finish and get AI feedback.')}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  {t('presentationMode.wholeSpeechTrains', 'Trains: delivery and word-for-word recall')}
                </p>
              </div>

              <Button className="w-full rounded-2xl" size="sm">
                {t('presentationMode.selectWholeSpeech', 'Select Whole Speech')}
              </Button>
            </div>
          </Card>

          {/* Script Mode */}
          <Card
            className="p-5 rounded-3xl border-2 hover:border-primary/50 transition-all duration-200 cursor-pointer"
            onClick={() => onSelectMode('overview')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold mb-1">{t('presentationMode.scriptMode', 'Script Mode')}</h3>
                <p className="text-muted-foreground text-xs">
                  {t('presentationMode.scriptModeDescV2', 'Read one beat at a time, then retell it from a reference word.')}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  {t('presentationMode.scriptModeTrains', 'Trains: meaning and structure, beat by beat')}
                </p>
              </div>

              <Button className="w-full rounded-2xl" size="sm" variant="outline">
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
  );
};
