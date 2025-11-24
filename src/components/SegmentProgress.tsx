import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Merge } from "lucide-react";

interface Segment {
  id: string;
  segment_order: number;
  segment_text: string;
  is_mastered: boolean;
  times_practiced: number;
  average_accuracy: number | null;
  merged_with_next: boolean;
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
            const previewText = segment.segment_text.slice(0, 60) + '...';

            return (
              <div
                key={segment.id}
                className={`
                  p-3 rounded-lg border-2 transition-all duration-300
                  ${isActive ? 'border-primary bg-primary/5 shadow-lg scale-105' : 'border-border/50'}
                  ${isMastered ? 'border-success bg-success/5' : ''}
                `}
              >
                <div className="flex items-start gap-3">
                  {isMastered ? (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        Segment {segment.segment_order + 1}
                      </span>
                      {isActive && (
                        <Badge variant="default" className="text-xs">
                          Active
                        </Badge>
                      )}
                      {segment.merged_with_next && (
                        <Merge className="w-3 h-3 text-cosmic-purple" />
                      )}
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">
                      {previewText}
                    </p>
                    
                    {segment.times_practiced > 0 && (
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Practiced: {segment.times_practiced}x</span>
                        {segment.average_accuracy !== null && (
                          <span>Avg: {Math.round(segment.average_accuracy)}%</span>
                        )}
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