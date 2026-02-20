import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar as CalendarIcon, Play, Trash2, Presentation, Clock, Crown, Mic, Eye, Target, Share2, Loader2, Check } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import LockCountdown from "./LockCountdown";
import { useSleepAwareTracking } from "@/hooks/useSleepAwareTracking";

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
  subscriptionTier?: 'free' | 'student' | 'regular' | 'enterprise';
  totalSpeeches?: number;
}

const SpeechCard = ({ speech, onUpdate, subscriptionTier = 'free', totalSpeeches = 1 }: SpeechCardProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showPresentationPremium, setShowPresentationPremium] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  
  // Check if this is the only speech for a free user
  const isOnlyFreeSpeech = subscriptionTier === 'free' && totalSpeeches === 1;
  
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
  const wordsMemorized = Math.max(0, originalWords - currentWords);
  const progress = originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;

  useEffect(() => {
    const checkSchedule = async () => {
      try {
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
          setIsLocked(reviewDate > new Date());
        }
      } catch (error) {
        console.error('Error checking schedule:', error);
      }
    };
    
    checkSchedule();
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [speech.id]);

  const { trackPracticeStart } = useSleepAwareTracking();

  const handleCardClick = () => {
    trackPracticeStart(speech.id);
    navigate(`/practice/${speech.id}`);
  };

  const handleDeadlineChange = async (newDate: Date | undefined) => {
    if (!newDate) return;
    try {
      const newGoalDate = format(newDate, "yyyy-MM-dd");
      
      // Update speech goal_date
      const { error } = await supabase
        .from("speeches")
        .update({ goal_date: newGoalDate })
        .eq("id", speech.id);
      if (error) throw error;

      // Recalculate segment schedules based on new deadline
      const { data: segments } = await supabase
        .from("speech_segments")
        .select("id, next_review_at")
        .eq("speech_id", speech.id);

      if (segments && segments.length > 0) {
        const now = new Date();
        const newGoal = new Date(newGoalDate);
        const daysLeft = Math.max(1, differenceInDays(newGoal, now));

        // Cap all segment review dates to not exceed the new deadline
        for (const segment of segments) {
          if (segment.next_review_at) {
            const reviewDate = new Date(segment.next_review_at);
            if (reviewDate > newGoal) {
              await supabase
                .from("speech_segments")
                .update({ next_review_at: newGoal.toISOString() })
                .eq("id", segment.id);
            }
          }
        }
      }

      // Also update schedule next_review_date if it exceeds new deadline
      const { data: schedule } = await supabase
        .from("schedules")
        .select("id, next_review_date")
        .eq("speech_id", speech.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (schedule?.next_review_date) {
        const newGoal = new Date(newGoalDate);
        const reviewDate = new Date(schedule.next_review_date);
        if (reviewDate > newGoal) {
          await supabase
            .from("schedules")
            .update({ next_review_date: newGoal.toISOString() })
            .eq("id", schedule.id);
        }
      }

      setDeadlineOpen(false);
      toast({ title: t('dashboard.deadlineUpdated', 'Deadline updated') });
      onUpdate();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("speeches")
        .delete()
        .eq("id", speech.id);

      if (error) throw error;

      toast({
        title: t('dashboard.deleted'),
        description: t('dashboard.deletedDesc'),
      });
      onUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSharing(true);
    try {
      // Check if speech already has a share token
      const { data: existing } = await supabase
        .from('speeches')
        .select('share_token')
        .eq('id', speech.id)
        .single();

      let token = existing?.share_token;

      if (!token) {
        // Generate a share token
        token = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
        const { error } = await supabase
          .from('speeches')
          .update({ share_token: token } as any)
          .eq('id', speech.id);
        if (error) throw error;
      }

      const shareUrl = `${window.location.origin}/share/${token}`;
      
      if (navigator.share) {
        await navigator.share({ title: speech.title, text: `Practice "${speech.title}" on Sermable`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
        toast({ title: t('dashboard.linkCopied', 'Link copied!'), description: t('dashboard.linkCopiedDesc', 'Share this link with others') });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast({ variant: "destructive", title: t('common.error'), description: err.message });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Card 
      className="group cursor-pointer hover:shadow-apple-xl transition-all duration-300 border-0"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate capitalize text-foreground">
              {speech.title}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {format(new Date(speech.created_at), "MMM dd, yyyy")}
            </CardDescription>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
            isOverdue 
              ? "bg-destructive/10 text-destructive" 
              : daysRemaining === 0
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "bg-secondary text-muted-foreground"
          }`}>
            {isOverdue
              ? t(Math.abs(daysRemaining) === 1 ? 'dashboard.daysOverdue' : 'dashboard.daysOverduePlural', { count: Math.abs(daysRemaining) })
              : daysRemaining === 0
                ? t('dashboard.presentationDay', '🎤 Presentation day!')
                : t(daysRemaining === 1 ? 'dashboard.daysLeft' : 'dashboard.daysLeftPlural', { count: daysRemaining })}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>{t('dashboard.goal')}: {format(goalDate, "MMM dd, yyyy")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" onClick={(e) => e.stopPropagation()}>
            <Calendar
              mode="single"
              selected={goalDate}
              onSelect={handleDeadlineChange}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {isLocked && nextReviewDate && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-xl">
            <Clock className="h-4 w-4 text-primary" />
            <div className="flex-1 text-xs">
              <span className="text-muted-foreground">{t('dashboard.nextPractice')} </span>
              <LockCountdown nextReviewDate={nextReviewDate} className="text-primary font-medium" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t('dashboard.progress')}</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {speech.text_original.substring(0, 120)}...
        </p>
      </CardContent>

      <CardFooter onClick={(e) => e.stopPropagation()}>
        <Button
          variant="apple"
          onClick={handleCardClick}
          className="flex-1"
          size="sm"
        >
          <Play className="h-4 w-4" />
          {t('dashboard.practice')}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={handleShare}
          disabled={isSharing}
        >
          {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : shareSuccess ? <Check className="h-4 w-4 text-green-500" /> : <Share2 className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (subscriptionTier === 'free') {
              setShowPresentationPremium(true);
            } else {
              navigate(`/presentation/${speech.id}`);
            }
          }}
        >
          <Presentation className="h-4 w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dashboard.deleteSpeech')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>{t('dashboard.deleteSpeechDesc', { title: speech.title })}</p>
                  {isOnlyFreeSpeech && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <p className="text-sm font-medium">
                        ⚠️ {t('dashboard.deleteOnlyFreeSpeechWarning', "This is your only free speech this month. Free users can only create 1 speech per month. If you delete it, you won't be able to create a new one until next month.")}
                      </p>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {t('common.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>

      {/* Presentation Mode Premium Dialog */}
      <Dialog open={showPresentationPremium} onOpenChange={setShowPresentationPremium}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center justify-center">
              <Presentation className="h-5 w-5 text-primary" />
              {t('settings.subscription.presentationMode', 'Presentation Mode')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground text-center">
              {t('practice.presentationPremiumDesc', 'Test your memory with a full run-through. Premium feature.')}
            </p>
            
            <div className="space-y-2 bg-muted/50 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.presentationFeature1', 'Real-time speech tracking')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.presentationFeature2', 'Teleprompter hints when stuck')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm">{t('practice.presentationFeature3', 'Detailed accuracy analysis')}</span>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex-col gap-2">
            <Button 
              onClick={() => {
                setShowPresentationPremium(false);
                navigate("/settings/payment");
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
            >
              <Crown className="h-4 w-4 mr-2" />
              {t('nav.upgradeToPremium', 'Upgrade to Premium')}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setShowPresentationPremium(false)}
              className="w-full text-muted-foreground"
            >
              {t('common.close', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SpeechCard;
