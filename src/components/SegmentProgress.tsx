import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Eye, Clock, Key, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Segment {
  id: string;
  segment_order: number;
  segment_text: string;
  is_mastered: boolean;
  times_practiced: number;
  average_accuracy: number | null;
  merged_with_next: boolean;
  visibility_percent?: number;
  anchor_keywords?: number[];
  next_review_at?: string;
}

interface SegmentProgressProps {
  segments: Segment[];
  activeSegmentIndices: number[];
}

const SegmentProgress = ({ segments, activeSegmentIndices }: SegmentProgressProps) => {
  const { t } = useTranslation();
  const masteredCount = segments.filter(s => s.is_mastered).length;
  const totalSegments = segments.length;

  // Count sentences in text
  const countSentences = (text: string): number => {
    const matches = text.match(/[.!?]+/g);
    return matches ? matches.length : 0;
  };

  // Count words in text
  const countWords = (text: string): number => {
    return text.split(/\s+/).filter(w => w.trim()).length;
  };

  return (
    <Card className="border-cosmic-teal/20 bg-gradient-to-br from-background to-cosmic-teal/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5 text-primary" />
          {t('practice.segments.learningProgress')}
          <Badge variant="secondary" className="ml-auto">
            {masteredCount} / {totalSegments}
          </Badge>
        </CardTitle>
        <Progress 
          value={(masteredCount / Math.max(totalSegments, 1)) * 100} 
          className="h-2 mt-2"
        />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {segments.map((segment, idx) => {
            const isActive = activeSegmentIndices.includes(segment.segment_order);
            const isMastered = segment.is_mastered;
            const visibility = segment.visibility_percent ?? 100;
            const anchorCount = segment.anchor_keywords?.length ?? 0;
            const nextReview = segment.next_review_at ? new Date(segment.next_review_at) : null;
            const isOverdue = nextReview && nextReview <= new Date();
            const sentenceCount = countSentences(segment.segment_text);
            const wordCount = countWords(segment.segment_text);
            
            // Clean text for display (remove brackets)
            const cleanText = segment.segment_text.replace(/\[|\]/g, '');
            const displayText = cleanText.length > 120 ? cleanText.slice(0, 120) + '...' : cleanText;

            return (
              <div
                key={segment.id}
                className={`
                  relative rounded-xl transition-all duration-300 overflow-hidden
                  ${isActive 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl' 
                    : 'border border-border/50 hover:border-border'}
                  ${isMastered ? 'bg-success/5' : 'bg-card'}
                  ${isOverdue && !isActive ? 'border-yellow-500/50' : ''}
                `}
              >
                {/* Segment header bar */}
                <div className={`
                  flex items-center gap-3 px-4 py-2.5 border-b
                  ${isActive ? 'bg-primary/10 border-primary/20' : 'bg-muted/30 border-border/30'}
                  ${isMastered ? 'bg-success/10 border-success/20' : ''}
                `}>
                  {isMastered ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  ) : (
                    <Circle className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary fill-primary/20' : 'text-muted-foreground'}`} />
                  )}
                  
                  <span className="font-semibold text-sm">
                    {t('practice.segments.segment')} {segment.segment_order + 1}
                  </span>
                  
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Badge variant="outline" className="text-xs font-normal">
                      {sentenceCount} {sentenceCount === 1 ? 'mening' : 'meningar'}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      {wordCount} ord
                    </Badge>
                  </div>
                  
                  {isActive && (
                    <Badge className="bg-primary text-primary-foreground text-xs animate-pulse">
                      {t('practice.segments.active')}
                    </Badge>
                  )}
                  {isOverdue && !isActive && (
                    <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 bg-yellow-500/10">
                      <Clock className="w-3 h-3 mr-1" />
                      {t('practice.segments.due')}
                    </Badge>
                  )}
                </div>
                
                {/* Segment content */}
                <div className="px-4 py-3">
                  <p className={`
                    text-sm leading-relaxed
                    ${isActive ? 'text-foreground' : 'text-muted-foreground'}
                  `}>
                    {displayText}
                  </p>
                  
                  {/* Stats row */}
                  {segment.times_practiced > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      {/* Visibility progress - show how close to 10% target */}
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 flex items-center gap-2">
                          <Progress 
                            value={100 - visibility} 
                            className="h-2 flex-1 bg-muted"
                          />
                          <span className={`text-xs font-medium min-w-[4rem] text-right ${
                            visibility <= 10 ? 'text-success' : 'text-primary'
                          }`}>
                            {Math.round(100 - visibility)}% {t('practice.segments.hidden')}
                            {visibility > 10 && (
                              <span className="text-muted-foreground ml-1">
                                (→90%)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      
                      {/* Mastery criteria hint */}
                      {!isMastered && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                          {visibility <= 10 ? (
                            <span className="text-primary">✓ Low visibility achieved! Need 100% accuracy to master.</span>
                          ) : segment.average_accuracy && segment.average_accuracy >= 98 ? (
                            <span className="text-primary">✓ Great accuracy! Reduce visibility to ≤10% to master.</span>
                          ) : (
                            <span>Goal: 100% accuracy + ≤10% script visibility</span>
                          )}
                        </div>
                      )}
                      
                      {/* Anchor keywords */}
                      {anchorCount > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Key className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {anchorCount} {anchorCount > 1 ? t('practice.segments.anchorKeywordsPlural') : t('practice.segments.anchorKeywords')}
                          </span>
                        </div>
                      )}
                      
                      {/* Practice stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">{segment.times_practiced}x</span> {t('practice.segments.practiced')}
                        </span>
                        {segment.average_accuracy !== null && (
                          <span className="flex items-center gap-1">
                            <span className={`font-medium ${segment.average_accuracy >= 98 ? 'text-success' : segment.average_accuracy >= 80 ? 'text-yellow-600' : 'text-destructive'}`}>
                              {Math.round(segment.average_accuracy)}%
                            </span> {t('practice.segments.avg')}
                          </span>
                        )}
                        {nextReview && (
                          <span className={`ml-auto ${isOverdue ? 'text-yellow-600 font-medium' : ''}`}>
                            {t('practice.segments.next')}: {formatDistanceToNow(nextReview, { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {masteredCount > 0 && masteredCount < totalSegments && (
          <div className="mt-6 p-4 bg-gradient-to-r from-cosmic-purple/10 to-primary/10 rounded-xl text-center border border-cosmic-purple/20">
            <p className="font-semibold text-cosmic-purple">
              🎉 {masteredCount > 1 
                ? t('practice.segments.greatProgressPlural', { count: masteredCount })
                : t('practice.segments.greatProgress', { count: masteredCount })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('practice.segments.keepGoing')}
            </p>
          </div>
        )}

        {masteredCount === totalSegments && totalSegments > 0 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-success/10 to-success/5 rounded-xl text-center border border-success/20">
            <p className="font-semibold text-success">
              🎊 {t('practice.segments.amazingMastered')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SegmentProgress;