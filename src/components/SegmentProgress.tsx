import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        <ScrollArea className={segments.length > 2 ? "h-[320px]" : ""}>
          <div className="space-y-2 pr-2">
            {segments.map((segment) => {
              const isActive = activeSegmentIndices.includes(segment.segment_order);
              const isMastered = segment.is_mastered;
              const visibility = segment.visibility_percent ?? 100;
              const nextReview = segment.next_review_at ? new Date(segment.next_review_at) : null;
              const isOverdue = nextReview && nextReview <= new Date();
              const wordCount = countWords(segment.segment_text);
              
              // Clean text for display (remove brackets)
              const cleanText = segment.segment_text.replace(/\[|\]/g, '');
              const displayText = cleanText.length > 80 ? cleanText.slice(0, 80) + '...' : cleanText;

              return (
                <div
                  key={segment.id}
                  className={`
                    relative rounded-lg transition-all duration-200 overflow-hidden
                    ${isActive 
                      ? 'ring-2 ring-primary ring-offset-1 ring-offset-background bg-primary/5' 
                      : 'border border-border/40 hover:border-border/70'}
                    ${isMastered && !isActive ? 'bg-success/5 border-success/30' : ''}
                    ${isOverdue && !isActive && !isMastered ? 'border-amber-500/50 bg-amber-500/5' : ''}
                  `}
                >
                  <div className="flex items-start gap-3 p-3">
                    {/* Status icon */}
                    <div className="pt-0.5">
                      {isMastered ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : isActive ? (
                        <Circle className="w-4 h-4 text-primary fill-primary/30" />
                      ) : isOverdue ? (
                        <Clock className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/50" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
                          {t('practice.segments.segment')} {segment.segment_order + 1}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {wordCount} ord
                        </span>
                        {isActive && (
                          <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 py-0">
                            {t('practice.segments.active')}
                          </Badge>
                        )}
                        {isOverdue && !isActive && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600 bg-amber-500/10">
                            {t('practice.segments.due')}
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {displayText}
                      </p>
                      
                      {/* Compact stats */}
                      {segment.times_practiced > 0 && (
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span className={visibility <= 10 ? 'text-success font-medium' : ''}>
                              {Math.round(100 - visibility)}% dolt
                            </span>
                          </div>
                          {segment.average_accuracy !== null && (
                            <span className={`font-medium ${
                              segment.average_accuracy >= 98 ? 'text-success' : 
                              segment.average_accuracy >= 80 ? 'text-amber-600' : 'text-muted-foreground'
                            }`}>
                              {Math.round(segment.average_accuracy)}% träffsäkerhet
                            </span>
                          )}
                          <span>{segment.times_practiced}x övat</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Progress indicator */}
                    {segment.times_practiced > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${isMastered ? 'bg-success' : 'bg-primary'}`}
                            style={{ width: `${Math.min(100, 100 - visibility)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

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