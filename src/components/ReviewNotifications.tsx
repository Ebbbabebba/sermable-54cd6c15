import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

interface DueReview {
  speech_id: string;
  speech_title: string;
  next_review_date: string;
  interval_days: number;
  success_rate: number;
  review_count: number;
  difficulty_level: string;
}

const ReviewNotifications = () => {
  const [dueReviews, setDueReviews] = useState<DueReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDueReviews();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadDueReviews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadDueReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('get_speeches_due_for_review', {
        p_user_id: user.id
      });

      if (error) throw error;
      setDueReviews(data || []);
    } catch (error) {
      console.error('Error loading due reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFeedback = async (speechId: string, remembered: boolean) => {
    setProcessingId(speechId);
    try {
      // Record a practice session with feedback
      const accuracy = remembered ? 95 : 40; // High score if remembered, low if forgot
      
      const { error } = await supabase
        .from('practice_sessions')
        .insert({
          speech_id: speechId,
          score: accuracy,
          missed_words: [],
          delayed_words: [],
          duration: 0,
          analysis: remembered 
            ? 'Quick review - remembered successfully' 
            : 'Quick review - needs more practice'
        });

      if (error) throw error;

      toast({
        title: remembered ? "Great job! 🎉" : "Keep practicing! 💪",
        description: remembered 
          ? "Your next review is scheduled based on your progress."
          : "We'll remind you sooner to help you master this speech.",
      });

      // Reload the due reviews
      await loadDueReviews();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (dueReviews.length === 0) {
    return null; // Don't show anything if no reviews due
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary animate-pulse" />
            <CardTitle>Speeches Due for Review</CardTitle>
          </div>
          <Badge variant="secondary" className="ml-2">
            {dueReviews.length} pending
          </Badge>
        </div>
        <CardDescription>
          These speeches need practice to maintain your progress
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {dueReviews.map((review) => (
          <div
            key={review.speech_id}
            className="flex items-center justify-between p-4 rounded-lg bg-card border hover:border-primary/50 transition-colors"
          >
            <div className="flex-1 min-w-0 mr-4">
              <h4 className="font-semibold truncate">{review.speech_title}</h4>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span>
                  Success Rate: {Math.round(review.success_rate)}%
                </span>
                <span>
                  Reviews: {review.review_count}
                </span>
                <Badge variant="outline" className="text-xs">
                  {review.difficulty_level}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/practice/${review.speech_id}`)}
                disabled={processingId === review.speech_id}
              >
                Full Practice
              </Button>
              
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                  onClick={() => handleQuickFeedback(review.speech_id, true)}
                  disabled={processingId === review.speech_id}
                  title="I remembered it"
                >
                  {processingId === review.speech_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => handleQuickFeedback(review.speech_id, false)}
                  disabled={processingId === review.speech_id}
                  title="I forgot it"
                >
                  {processingId === review.speech_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ReviewNotifications;
