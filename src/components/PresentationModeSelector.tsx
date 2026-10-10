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
    border: "s-7s s-hf",
    iconTile: "s-5e",
    icon: "s-uw",
    title: "s-u9",
    button: "s-5c s-ux s-h8",
  },
  overview: {
    border: "s-81 s-hj",
    iconTile: "s-60",
    icon: "s-va",
    title: "s-u9",
    button: "s-5z s-vb s-hc",
  },
  keycards: {
    border: "s-7a s-he",
    iconTile: "s-4n",
    icon: "s-u5",
    title: "s-u9",
    button: "s-4m s-u6 s-gy",
  },
} as const;

export const PresentationModeSelector = ({
  onSelectMode,
}: PresentationModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className="s-gi s-c5 s-id s-k8 s-ig s-os s-n9 s-ob s-ki s-40 s-mq">
      <div className="s-y7 s-jf s-t3">
        <div className="s-u0 s-sy">
          <h1 className="s-ta s-kk s-cx s-u9">
            {t('presentationMode.chooseMode')}
          </h1>
          <p className="s-ul">
            {t('presentationMode.selectHow')}
          </p>
        </div>

        <div className="s-e0 s-k7 s-dq">
          {/* Whole Speech Mode — amber */}
          <Card
            className={`s-mx s-qa s-6n ${modeThemes.strict.border} s-wr s-bo s-8m`}
            onClick={() => onSelectMode('strict')}
          >
            <div className="s-t1">
              <div className="s-c5 s-ib s-dp">
                <div className={`s-fo s-xg s-q9 ${modeThemes.strict.iconTile} s-c5 s-ib s-ig`}>
                  <MonitorPlay className={`s-g1 s-xv ${modeThemes.strict.icon}`} />
                </div>
              </div>

              <div>
                <h3 className={`s-uk s-cx s-jw ${modeThemes.strict.title}`}>
                  {t('presentationMode.wholeSpeechMode', 'Whole Speech Mode')}
                </h3>
                <p className="s-ul s-vj">
                  {t('presentationMode.wholeSpeechModeDescV2', 'Run the whole speech from start to finish and get AI feedback.')}
                </p>
                <p className="s-tm s-uq s-lv">
                  {t('presentationMode.wholeSpeechTrains', 'Trains: delivery and word-for-word recall')}
                </p>
              </div>

              <Button className={`s-y7 s-q9 ${modeThemes.strict.button}`} size="sm">
                {t('presentationMode.selectWholeSpeech', 'Select Whole Speech')}
              </Button>
            </div>
          </Card>

          {/* Script Mode — green */}
          <Card
            className={`s-mx s-qa s-6n ${modeThemes.overview.border} s-wr s-bo s-8m`}
            onClick={() => onSelectMode('overview')}
          >
            <div className="s-t1">
              <div className="s-c5 s-ib s-dp">
                <div className={`s-fo s-xg s-q9 ${modeThemes.overview.iconTile} s-c5 s-ib s-ig`}>
                  <BookOpen className={`s-g1 s-xv ${modeThemes.overview.icon}`} />
                </div>
              </div>

              <div>
                <h3 className={`s-uk s-cx s-jw ${modeThemes.overview.title}`}>
                  {t('presentationMode.scriptMode', 'Script Mode')}
                </h3>
                <p className="s-ul s-vj">
                  {t('presentationMode.scriptModeDescV2', 'Read one beat at a time, then retell it from a reference word.')}
                </p>
                <p className="s-tm s-uq s-lv">
                  {t('presentationMode.scriptModeTrains', 'Trains: meaning and structure, beat by beat')}
                </p>
              </div>

              <Button className={`s-y7 s-q9 ${modeThemes.overview.button}`} size="sm">
                {t('presentationMode.selectScript', 'Select Script')}
              </Button>
            </div>
          </Card>

          {/* Keycards — purple */}
          <Card
            className={`s-mx s-qa s-6n ${modeThemes.keycards.border} s-wr s-bo s-8m`}
            onClick={() => onSelectMode('keycards')}
          >
            <div className="s-t1">
              <div className="s-c5 s-ib s-dp">
                <div className={`s-fo s-xg s-q9 ${modeThemes.keycards.iconTile} s-c5 s-ib s-ig`}>
                  <Layers className={`s-g1 s-xv ${modeThemes.keycards.icon}`} />
                </div>
              </div>
              <div>
                <h3 className={`s-uk s-cx s-jw ${modeThemes.keycards.title}`}>
                  {t('presentationMode.keycardsMode', 'Keycards')}
                </h3>
                <p className="s-ul s-vj">{t('presentationMode.keycardsModeDesc')}</p>
                <p className="s-tm s-uq s-lv">{t('presentationMode.keycardsTrains')}</p>
              </div>
              <Button className={`s-y7 s-q9 ${modeThemes.keycards.button}`} size="sm">
                {t('presentationMode.selectKeycards', 'Select Keycards')}
              </Button>
            </div>
          </Card>
        </div>

        <p className="s-u0 s-v9 s-ul">
          {t('presentationMode.switchModes')}
        </p>
      </div>
    </div>
  );
};
