import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Trash2, Presentation, Lock, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LockCountdown from "./LockCountdown";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  created_at: string;
}

interface SpeechCardProps {
  speech: Speech;
  onUpdate: () => void;
}

const SpeechCard = ({ speech, onUpdate }: SpeechCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLocked, setIsLocked] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState<number | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [showLockDialog, setShowLockDialog] = useState(false);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  // Calculate memorization progress based on how many words have been mastered
  // Progress = percentage of words removed from text_current (mastered)
  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
  const wordsMemorized = Math.max(0, originalWords - currentWords);
  const progress = originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;
  
  useEffect(() => {
    const checkLockStatus = async () => {
      try {
        // Get user subscription tier
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();
          
        if (profile) {
          setSubscriptionTier(profile.subscription_tier);
        }
        
        // Get schedule data - use next_review_date directly for accurate timing
        const { data: schedule } = await supabase
          .from("schedules")
          .select("next_review_date, last_reviewed_at")
          .eq("speech_id", speech.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        
        // Get speech performance data
        const { data: speechData } = await supabase
          .from("speeches")
          .select("last_accuracy")
          .eq("id", speech.id)
          .single();
          
        if (speechData?.last_accuracy) {
          setLastAccuracy(speechData.last_accuracy);
        }
          
        if (schedule?.next_review_date) {
          const reviewDate = new Date(schedule.next_review_date);
          const now = new Date();
          setNextReviewDate(reviewDate);
          
          // Calculate actual interval in minutes from the timestamps
          if (schedule.last_reviewed_at) {
            const lastReviewed = new Date(schedule.last_reviewed_at);
            const actualIntervalMs = reviewDate.getTime() - lastReviewed.getTime();
            setIntervalMinutes(Math.round(actualIntervalMs / (1000 * 60)));
          }
          
          // Lock only for free users when review date is in future
          if (profile?.subscription_tier === 'free' && reviewDate > now) {
            setIsLocked(true);
          } else {
            setIsLocked(false);
          }
        }
      } catch (error) {
        console.error('Error checking lock status:', error);
      }
    };
    
    checkLockStatus();
    
    // Re-check lock status every minute to update countdown
    const interval = setInterval(checkLockStatus, 60000);
    return () => clearInterval(interval);
  }, [speech.id]);

  const handleCardClick = () => {
    if (isLocked && subscriptionTier === 'free') {
      setShowLockDialog(true);
    } else {
      navigate(`/practice/${speech.id}`);
    }
  };

  const handlePracticeAnyway = () => {
    setShowLockDialog(false);
    navigate(`/practice/${speech.id}`);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("speeches")
        .delete()
        .eq("id", speech.id);

      if (error) throw error;

      toast({
        title: "Speech deleted",
        description: "The speech has been removed.",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  return (
    <>
      <Card 
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={handleCardClick}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate capitalize">{speech.title}</CardTitle>
              <CardDescription className="mt-1">
                Created {format(new Date(speech.created_at), "MMM dd, yyyy")}
              </CardDescription>
            </div>
            <Badge variant={isOverdue ? "destructive" : "secondary"}>
              {isOverdue
                ? `${Math.abs(daysRemaining)} days overdue`
                : `${daysRemaining} days left`}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Goal: {format(goalDate, "MMM dd, yyyy")}</span>
          </div>

          {isLocked && nextReviewDate && (
            <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Next practice</span>
                  <LockCountdown nextReviewDate={nextReviewDate} className="text-primary font-semibold" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {lastAccuracy !== null && lastAccuracy >= 80 
                    ? "Great progress! Rest helps memory consolidation."
                    : lastAccuracy !== null && lastAccuracy >= 60
                    ? "Good effort! Short break to absorb the material."
                    : "Keep practicing - frequent reps build memory."}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2">
            {speech.text_original.substring(0, 150)}...
          </p>
        </CardContent>

        <CardFooter className="gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="default"
            onClick={handleCardClick}
            className="flex-1"
          >
            <Play className="h-4 w-4 mr-2" />
            Practice
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate(`/presentation/${speech.id}`)}
          >
            <Presentation className="h-4 w-4 mr-2" />
            Present
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Speech?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "<span className="capitalize">{speech.title}</span>" and all associated practice sessions.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>

      {/* Lock Dialog for Free Users */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Automatic Practice Schedule</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Based on your performance, your next practice is scheduled{" "}
              {nextReviewDate && <LockCountdown nextReviewDate={nextReviewDate} className="font-medium text-foreground" />}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-primary/5 p-4 rounded-lg space-y-3 border border-primary/10">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-medium">How it works</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>High accuracy + low script visibility</strong> = longer breaks (up to 24h)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Low accuracy or high visibility</strong> = shorter breaks (5-30 min)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Deadline approaching</strong> = more frequent practice automatically</span>
                </li>
              </ul>
            </div>
            
            {subscriptionTier !== 'free' && (
              <p className="text-xs text-center text-muted-foreground">
                Premium members can practice anytime
              </p>
            )}
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowLockDialog(false)} className="flex-1">
              Wait
            </Button>
            <Button onClick={handlePracticeAnyway} className="flex-1">
              Practice Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SpeechCard;
