import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Trash2, Presentation, Lock } from "lucide-react";
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
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  // Calculate progress (simplified - in production this would be based on practice sessions)
  const progress = 0; // Will be calculated from practice sessions
  
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
        
        // Get schedule data to check if locked
        const { data: schedule } = await supabase
          .from("schedules")
          .select("next_review_date")
          .eq("speech_id", speech.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
          
        if (schedule?.next_review_date) {
          const reviewDate = new Date(schedule.next_review_date);
          setNextReviewDate(reviewDate);
          
          // Lock only for free users when review date is in future
          if (profile?.subscription_tier === 'free' && reviewDate > new Date()) {
            setIsLocked(true);
          }
        }
      } catch (error) {
        console.error('Error checking lock status:', error);
      }
    };
    
    checkLockStatus();
  }, [speech.id]);

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
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate">{speech.title}</CardTitle>
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

      <CardFooter className="gap-2">
        <Button
          className="flex-1"
          onClick={() => navigate(`/practice/${speech.id}`)}
          disabled={isLocked && subscriptionTier === 'free'}
        >
          {isLocked && subscriptionTier === 'free' && <Lock className="h-4 w-4 mr-2" />}
          {!isLocked && <Play className="h-4 w-4 mr-2" />}
          {isLocked && subscriptionTier === 'free' 
            ? `Locked until ${nextReviewDate ? format(nextReviewDate, 'MMM dd') : ''}` 
            : 'Practice'}
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
                This will permanently delete "{speech.title}" and all associated practice sessions.
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
  );
};

export default SpeechCard;
