import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Merge, Eye, Clock, Key } from "lucide-react";
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
  const masteredCount = segments.filter(s => s.is_mastered).length;
  const totalSegments = segments.length;

  return (
    <Card className="border-cosmic-teal/20 bg-gradient-to-br from-background to-cosmic-teal/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-2xl">🎯</span>
          Learning Progress
          <Badge variant="secondary" className="ml-auto">
            {masteredCount} / {totalSegments}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {segments.map((segment, idx) => {
            const isActive = activeSegmentIndices.includes(segment.segment_order);
            const isMastered = segment.is_mastered;
            const previewText = segment.segment_text.slice(0, 60) + (segment.segment_text.length > 60 ? '...' : '');
            const visibility = segment.visibility_percent ?? 100;
            const anchorCount = segment.anchor_keywords?.length ?? 0;
            const nextReview = segment.next_review_at ? new Date(segment.next_review_at) : null;
            const isOverdue = nextReview && nextReview <= new Date();

            return (
              <div
                key={segment.id}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-300
                  ${isActive ? 'border-primary bg-primary/5 shadow-lg scale-105' : 'border-border/50'}
                  ${isMastered ? 'border-success bg-success/5' : ''}
                  ${isOverdue && !isActive ? 'border-yellow-500/50 bg-yellow-500/5' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  {isMastered ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">
                        Segment {segment.segment_order + 1}
                      </span>
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                      {isOverdue && !isActive && (
                        <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Due
                        </Badge>
                      )}
                      {segment.merged_with_next && (
                        <Merge className="w-3 h-3 text-cosmic-purple" />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">
                      {previewText}
                    </p>
                    
                    {/* Visibility Progress Bar */}
                    {segment.times_practiced > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          <span>Visibility: {Math.round(visibility)}%</span>
                          <Progress 
                            value={100 - visibility} 
                            className="h-1.5 flex-1 bg-muted"
                          />
                          <span className="text-xs font-medium text-primary">
                            {Math.round(100 - visibility)}% hidden
                          </span>
                        </div>
                        
                        {/* Anchor Keywords */}
                        {anchorCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Key className="w-3 h-3 text-yellow-500" />
                            <span className="text-yellow-600 dark:text-yellow-400">
                              {anchorCount} anchor keyword{anchorCount > 1 ? 's' : ''} (hard words)
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Practiced: {segment.times_practiced}x</span>
                          {segment.average_accuracy !== null && (
                            <span>Avg: {Math.round(segment.average_accuracy)}%</span>
                          )}
                          {nextReview && (
                            <span className={isOverdue ? 'text-yellow-600' : ''}>
                              Next: {formatDistanceToNow(nextReview, { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {masteredCount > 0 && masteredCount < totalSegments && (
          <div className="mt-4 p-3 bg-cosmic-purple/10 rounded-lg text-sm text-center">
            <p className="font-semibold text-cosmic-purple">
              🎉 Great progress! {masteredCount} segment{masteredCount > 1 ? 's' : ''} mastered
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Keep going to merge and master the full speech!
            </p>
          </div>
        )}

        {masteredCount === totalSegments && (
          <div className="mt-4 p-3 bg-success/10 rounded-lg text-sm text-center">
            <p className="font-semibold text-success">
              🎊 Amazing! You've mastered the entire speech!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SegmentProgress;
