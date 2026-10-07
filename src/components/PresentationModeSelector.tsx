import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonitorPlay, BookOpen, Layers } from "lucide-react";

interface PresentationModeSelectorProps {
  onSelectMode: (mode: 'strict' | 'overview' | 'keycards') => void;
}

// Each mode gets its own distinct color family
const modeThemes = {
  strict: {
    border: "border-primary/40 hover:border-primary",
    iconTile: "bg-primary/10",
    icon: "text-primary",
    title: "text-foreground",
    button: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  overview: {
    border: "border-success/40 hover:border-success",
    iconTile: "bg-success/10",
    icon: "text-success",
    title: "text-foreground",
    button: "bg-success text-success-foreground hover:bg-success/90",
  },
  keycards: {
    border: "border-duo-purple/40 hover:border-duo-purple",
    iconTile: "bg-duo-purple/10",
    icon: "text-duo-purple",
    title: "text-foreground",
    button: "bg-duo-purple text-duo-purple-foreground hover:bg-duo-purple/90",
  },
} as const;

export const PresentationModeSelector = ({
  onSelectMode,
}: PresentationModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className="h-screen flex items-start md:items-center justify-center px-4 pb-6 pt-28 md:pt-8 bg-gradient-to-br from-background via-background to-primary/5 overflow-y-auto">
      <div className="w-full max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {t('presentationMode.chooseMode')}
          </h1>
          <p className="text-muted-foreground">
            {t('presentationMode.selectHow')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Whole Speech Mode — amber */}
          <Card
            className={`p-5 rounded-3xl border-2 ${modeThemes.strict.border} transition-all duration-200 cursor-pointer`}
            onClick={() => onSelectMode('strict')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl ${modeThemes.strict.iconTile} flex items-center justify-center`}>
                  <MonitorPlay className={`h-5 w-5 ${modeThemes.strict.icon}`} />
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-bold mb-1 ${modeThemes.strict.title}`}>
                  {t('presentationMode.wholeSpeechMode', 'Whole Speech Mode')}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t('presentationMode.wholeSpeechModeDescV2', 'Run the whole speech from start to finish and get AI feedback.')}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  {t('presentationMode.wholeSpeechTrains', 'Trains: delivery and word-for-word recall')}
                </p>
              </div>

              <Button className={`w-full rounded-2xl ${modeThemes.strict.button}`} size="sm">
                {t('presentationMode.selectWholeSpeech', 'Select Whole Speech')}
              </Button>
            </div>
          </Card>

          {/* Script Mode — green */}
          <Card
            className={`p-5 rounded-3xl border-2 ${modeThemes.overview.border} transition-all duration-200 cursor-pointer`}
            onClick={() => onSelectMode('overview')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl ${modeThemes.overview.iconTile} flex items-center justify-center`}>
                  <BookOpen className={`h-5 w-5 ${modeThemes.overview.icon}`} />
                </div>
              </div>

              <div>
                <h3 className={`text-lg font-bold mb-1 ${modeThemes.overview.title}`}>
                  {t('presentationMode.scriptMode', 'Script Mode')}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {t('presentationMode.scriptModeDescV2', 'Read one beat at a time, then retell it from a reference word.')}
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  {t('presentationMode.scriptModeTrains', 'Trains: meaning and structure, beat by beat')}
                </p>
              </div>

              <Button className={`w-full rounded-2xl ${modeThemes.overview.button}`} size="sm">
                {t('presentationMode.selectScript', 'Select Script')}
              </Button>
            </div>
          </Card>

          {/* Keycards — purple */}
          <Card
            className={`p-5 rounded-3xl border-2 ${modeThemes.keycards.border} transition-all duration-200 cursor-pointer`}
            onClick={() => onSelectMode('keycards')}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-2xl ${modeThemes.keycards.iconTile} flex items-center justify-center`}>
                  <Layers className={`h-5 w-5 ${modeThemes.keycards.icon}`} />
                </div>
              </div>
              <div>
                <h3 className={`text-lg font-bold mb-1 ${modeThemes.keycards.title}`}>
                  {t('presentationMode.keycardsMode', 'Keycards')}
                </h3>
                <p className="text-muted-foreground text-xs">{t('presentationMode.keycardsModeDesc')}</p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">{t('presentationMode.keycardsTrains')}</p>
              </div>
              <Button className={`w-full rounded-2xl ${modeThemes.keycards.button}`} size="sm">
                {t('presentationMode.selectKeycards', 'Select Keycards')}
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
