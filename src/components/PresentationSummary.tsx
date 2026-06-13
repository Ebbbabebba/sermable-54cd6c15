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
    if (accuracy >= 90) return "text-success";
    if (accuracy >= 75) return "text-warning";
    return "text-destructive";
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
    <div className="min-h-screen bg-background p-8 animate-fade-in">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">{header.title}</h1>
          <p className="text-xl text-muted-foreground">{header.subtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("presentationSummary.performanceSummary")}</CardTitle>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <span className="font-semibold">{t("presentationSummary.accuracy")}</span>
                </div>
                <span className={`text-2xl font-bold ${getAccuracyColor()}`}>
                  {accuracy.toFixed(1)}%
                </span>
              </div>
              <Progress value={accuracy} className="h-3" />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-semibold">{t("presentationSummary.duration")}</span>
              </div>
              <span className="text-lg">
                {minutes > 0 && `${minutes}m `}{seconds}s
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                <span className="font-semibold">{t("presentationSummary.hesitations")}</span>
              </div>
              <span className="text-lg">{hesitations}</span>
            </div>

            {missedWords.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-destructive" />
                  <span className="font-semibold">{t("presentationSummary.missedWords")} ({missedWords.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {missedWords.slice(0, 10).map((word, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {word}
                    </Badge>
                  ))}
                  {missedWords.length > 10 && (
                    <Badge variant="outline" className="text-xs">
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
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t("presentationSummary.summary")}</h4>
              <p className="text-muted-foreground">{feedbackSummary}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">{t("presentationSummary.advice")}</h4>
              <p className="text-muted-foreground whitespace-pre-line">{feedbackAdvice}</p>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t("presentationSummary.nextStep")}
              </h4>
              <p className="text-sm">{feedbackNextStep}</p>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={onExit}
          className="w-full"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("presentationSummary.backToDashboard")}
        </Button>
      </div>
    </div>
  );
};

export default PresentationSummary;
