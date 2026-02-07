import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hash, Quote, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

interface OverviewTopicCardProps {
  topicOrder: number;
  topicTitle: string;
  keyWords: string[];
  keyNumbers: string[];
  keyPhrases: string[];
  hintLevel: 1 | 2 | 3;
  lastScore?: number | null;
  isActive?: boolean;
  className?: string;
}

export const OverviewTopicCard = ({
  topicOrder,
  topicTitle,
  keyWords,
  keyNumbers,
  keyPhrases,
  hintLevel,
  lastScore,
  isActive = false,
  className,
}: OverviewTopicCardProps) => {
  const { t } = useTranslation();

  const showTitle = hintLevel <= 2;
  const showContent = hintLevel === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: topicOrder * 0.1 }}
    >
      <Card className={cn(
        "p-4 transition-all duration-300 border-2",
        isActive ? "border-primary bg-primary/5 shadow-lg" : "border-border",
        className
      )}>
        {/* Section Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
              {topicOrder}
            </div>
            {showTitle ? (
              <h3 className="font-semibold text-foreground leading-tight">
                {topicTitle}
              </h3>
            ) : (
              <h3 className="font-semibold text-muted-foreground leading-tight italic">
                {t('overviewMode.section')} {topicOrder}
              </h3>
            )}
          </div>
          
          {lastScore !== null && lastScore !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {lastScore}%
            </Badge>
          )}
        </div>

        {/* Three Column Layout */}
        {showContent && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            {/* Key Words Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Hash className="w-3 h-3" />
                {t('overviewMode.keyWords')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {keyWords.map((word, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs bg-primary/5 border-primary/20 text-foreground"
                  >
                    {word}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Key Numbers Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <BarChart3 className="w-3 h-3" />
                {t('overviewMode.keyNumbers')}
              </div>
              <div className="space-y-1">
                {keyNumbers.length > 0 ? (
                  keyNumbers.map((num, i) => (
                    <div key={i} className="text-sm font-mono text-foreground bg-accent/50 rounded px-2 py-0.5">
                      {num}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">—</span>
                )}
              </div>
            </div>

            {/* Key Phrases Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Quote className="w-3 h-3" />
                {t('overviewMode.keyPhrases')}
              </div>
              <div className="space-y-1">
                {keyPhrases.map((phrase, i) => (
                  <div key={i} className="text-sm italic text-foreground">
                    "{phrase}"
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Titles-only mode: show column headers but no content */}
        {hintLevel === 2 && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Hash className="w-3 h-3" />
              {keyWords.length} {t('overviewMode.keyWords').toLowerCase()}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="w-3 h-3" />
              {keyNumbers.length} {t('overviewMode.keyNumbers').toLowerCase()}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Quote className="w-3 h-3" />
              {keyPhrases.length} {t('overviewMode.keyPhrases').toLowerCase()}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default OverviewTopicCard;
