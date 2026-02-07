import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

interface SectionScore {
  topic_id: string;
  topic_title: string;
  score: number;
  main_idea_captured: boolean;
  key_words_mentioned: string[];
  key_words_missed: string[];
  numbers_mentioned: string[];
  numbers_missed: string[];
  phrases_mentioned: string[];
  phrases_missed: string[];
  feedback: string;
}

interface OverviewResultsProps {
  sectionScores: SectionScore[];
  overallScore: number;
  onRetry: () => void;
  onBack: () => void;
}

export const OverviewResults = ({
  sectionScores,
  overallScore,
  onRetry,
  onBack,
}: OverviewResultsProps) => {
  const { t } = useTranslation();

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Overall Score Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <div className={`text-6xl font-bold ${getScoreColor(overallScore)}`}>
            {overallScore}%
          </div>
          <p className="text-muted-foreground mt-2">
            {t('overviewMode.contentCoverage')}
          </p>
          <div className="mt-4 max-w-xs mx-auto">
            <Progress value={overallScore} className="h-3" />
          </div>
        </motion.div>

        {/* Per-Section Breakdown */}
        {sectionScores.map((section, index) => (
          <motion.div
            key={section.topic_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {index + 1}. {section.topic_title}
                  </CardTitle>
                  <span className={`text-lg font-bold ${getScoreColor(section.score)}`}>
                    {section.score}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Status Indicators */}
                <div className="space-y-1.5">
                  {/* Main idea */}
                  <div className="flex items-center gap-2 text-sm">
                    {section.main_idea_captured ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    <span className={section.main_idea_captured ? "text-foreground" : "text-muted-foreground"}>
                      {t('overviewMode.mainIdea')}
                    </span>
                  </div>

                  {/* Key words */}
                  {section.key_words_missed.length > 0 ? (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        {t('overviewMode.missedKeywords')}: {section.key_words_missed.join(", ")}
                      </span>
                    </div>
                  ) : section.key_words_mentioned.length > 0 ? (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-foreground">{t('overviewMode.allKeywordsCovered')}</span>
                    </div>
                  ) : null}

                  {/* Numbers */}
                  {section.numbers_missed.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        {t('overviewMode.missedNumbers')}: {section.numbers_missed.join(", ")}
                      </span>
                    </div>
                  )}

                  {/* Phrases */}
                  {section.phrases_missed.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        {t('overviewMode.missedPhrases')}: {section.phrases_missed.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Feedback */}
                {section.feedback && (
                  <p className="text-sm text-muted-foreground pt-2 border-t border-border">
                    {section.feedback}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>
          <Button onClick={onRetry} className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            {t('overviewMode.tryAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OverviewResults;
