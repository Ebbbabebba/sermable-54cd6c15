import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, Clock, AlertCircle, TrendingUp, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PresentationSummaryProps {
  accuracy: number;
  duration: number;
  hesitations: number;
  missedWords: string[];
  feedbackSummary: string;
  feedbackAdvice: string;
  feedbackNextStep: string;
  onExit: () => void;
}

const PresentationSummary = ({
  accuracy,
  duration,
  hesitations,
  missedWords,
  feedbackSummary,
  feedbackAdvice,
  feedbackNextStep,
  onExit,
}: PresentationSummaryProps) => {
  const { t } = useTranslation();

  const getAccuracyColor = () => {
    if (accuracy >= 90) return "s-va";
    if (accuracy >= 75) return "s-ve";
    return "s-u2";
  };

  const getAccuracyBadge = () => {
    if (accuracy >= 90) return { label: t("presentationSummary.badgeExcellent"), variant: "default" as const };
    if (accuracy >= 75) return { label: t("presentationSummary.badgeGood"), variant: "secondary" as const };
    return { label: t("presentationSummary.badgeNeedsWork"), variant: "destructive" as const };
  };

  const badge = getAccuracyBadge();
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const getHeaderContent = () => {
    if (accuracy >= 90) {
      return { title: t("presentationSummary.excellent"), subtitle: t("presentationSummary.excellentSubtitle") };
    }
    if (accuracy >= 75) {
      return { title: t("presentationSummary.goodJob"), subtitle: t("presentationSummary.goodJobSubtitle") };
    }
    return { title: t("presentationSummary.keepPracticing"), subtitle: t("presentationSummary.keepPracticingSubtitle") };
  };

  const header = getHeaderContent();

  return (
    <div className="s-l6 s-3v s-mz s-2y">
      <div className="s-jd s-m9 s-t3">
        <div className="s-u0 s-t1">
          <h1 className="s-tb s-cx">{header.title}</h1>
          <p className="s-vi s-ul">{header.subtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="s-c5 s-ib s-if">
              <CardTitle>{t("presentationSummary.performanceSummary")}</CardTitle>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="s-t3">
            <div className="s-sy">
              <div className="s-c5 s-ib s-if">
                <div className="s-c5 s-ib s-dn">
                  <Award className="s-g1 s-xv s-uw" />
                  <span className="s-d3">{t("presentationSummary.accuracy")}</span>
                </div>
                <span className={`s-t9 s-cx ${getAccuracyColor()}`}>
                  {accuracy.toFixed(1)}%
                </span>
              </div>
              <Progress value={accuracy} className="s-fw" />
            </div>

            <div className="s-c5 s-ib s-if">
              <div className="s-c5 s-ib s-dn">
                <Clock className="s-g1 s-xv s-uw" />
                <span className="s-d3">{t("presentationSummary.duration")}</span>
              </div>
              <span className="s-uk">
                {minutes > 0 && `${minutes}m `}{seconds}s
              </span>
            </div>

            <div className="s-c5 s-ib s-if">
              <div className="s-c5 s-ib s-dn">
                <AlertCircle className="s-g1 s-xv s-ve" />
                <span className="s-d3">{t("presentationSummary.hesitations")}</span>
              </div>
              <span className="s-uk">{hesitations}</span>
            </div>

            {missedWords.length > 0 && (
              <div className="s-sy">
                <div className="s-c5 s-ib s-dn">
                  <TrendingUp className="s-g1 s-xv s-u2" />
                  <span className="s-d3">{t("presentationSummary.missedWords")} ({missedWords.length})</span>
                </div>
                <div className="s-c5 s-cb s-dn">
                  {missedWords.slice(0, 10).map((word, i) => (
                    <Badge key={i} variant="outline" className="s-vj">
                      {word}
                    </Badge>
                  ))}
                  {missedWords.length > 10 && (
                    <Badge variant="outline" className="s-vj">
                      +{missedWords.length - 10} {t("presentationSummary.more")}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("presentationSummary.coachsFeedback")}</CardTitle>
            <CardDescription>{t("presentationSummary.coachsFeedbackDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="s-t1">
            <div>
              <h4 className="s-d3 s-jy">{t("presentationSummary.summary")}</h4>
              <p className="s-ul">{feedbackSummary}</p>
            </div>

            <div>
              <h4 className="s-d3 s-jy">{t("presentationSummary.advice")}</h4>
              <p className="s-ul s-yc">{feedbackAdvice}</p>
            </div>

            <div className="s-mw s-5j s-qh s-6l s-7p">
              <h4 className="s-d3 s-jy s-c5 s-ib s-dn">
                <TrendingUp className="s-fz s-xt s-uw" />
                {t("presentationSummary.nextStep")}
              </h4>
              <p className="s-v9">{feedbackNextStep}</p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={onExit}
          className="s-y7"
        >
          <ArrowLeft className="s-fz s-xt s-lp" />
          {t("presentationSummary.backToDashboard")}
        </Button>
      </div>
    </div>
  );
};

export default PresentationSummary;
