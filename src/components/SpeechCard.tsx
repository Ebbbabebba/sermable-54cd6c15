import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar as CalendarIcon, Play, Trash2, Presentation, Clock, Crown, Mic, Eye, Target } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { FORCE_PREMIUM } from "@/lib/premiumOverride";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { stripPropCueMarkers } from "@/utils/propCues";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [masteryPercent, setMasteryPercent] = useState<number | null>(null);
  
  
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  const originalWords = stripPropCueMarkers(speech.text_original).split(/\s+/).filter(w => w.length > 0).length;
  const currentWords = stripPropCueMarkers(speech.text_current).split(/\s+/).filter(w => w.length > 0).length;
  const wordsMemorized = Math.max(0, originalWords - currentWords);
  const progress = originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;

  useEffect(() => {
    let cancelled = false;
    const checkSchedule = async () => {
      try {
        const { data: schedule } = await supabase
          .from("schedules")
          .select("next_review_date")
          .eq("speech_id", speech.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (cancelled) return;
        if (schedule?.next_review_date) {
          const reviewDate = new Date(schedule.next_review_date);
          setNextReviewDate(reviewDate);
          setIsLocked(reviewDate > new Date());
        }
      } catch (error) {
        // silent — schedule may not exist yet
      }
    };

    checkSchedule();
    return () => { cancelled = true; };
  }, [speech.id]);


  useEffect(() => {
    const fetchMastery = async () => {
      try {
        // Mastery = % of beats mastered (clean rep with all words hidden).
        // Prefer practice_beats; fall back to speech_segments. This matches Practice page logic
        // and is achievable even when speech recognition mishears individual words.
        const { data: beats } = await supabase
          .from("practice_beats")
          .select("is_mastered")
          .eq("speech_id", speech.id);

        if (beats && beats.length > 0) {
          const mastered = beats.filter(b => b.is_mastered).length;
          setMasteryPercent(Math.round((mastered / beats.length) * 100));
          return;
        }

        const { data: segments } = await supabase
          .from("speech_segments")
          .select("is_mastered")
          .eq("speech_id", speech.id);

        if (segments && segments.length > 0) {
          const mastered = segments.filter(s => s.is_mastered).length;
          setMasteryPercent(Math.round((mastered / segments.length) * 100));
        }
      } catch (error) {
        console.error('Error fetching mastery:', error);
      }
    };
    fetchMastery();
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

      // Regenerate calendar events for the new deadline
      try {
        const { error: scheduleError } = await supabase.functions.invoke('generate-speech-schedule', {
          body: { speechId: speech.id }
        });
        if (scheduleError) {
          console.error('⚠️ Error regenerating calendar:', scheduleError);
        }
      } catch (e) {
        console.error('⚠️ Calendar regeneration failed:', e);
      }

      setDeadlineOpen(false);
      toast({ title: t('dashboard.deadlineUpdated', 'Deadline updated') });
      onUpdate();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
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
    } finally {
      setIsDeleting(false);
    }
  };



  return (
    <Card 
      className="speech-row"
      onClick={handleCardClick}
    >
      <CardHeader className="speech-row__header">
        <div className="s-c5 s-id s-if s-dp">
          <div className="s-c5 s-l8 s-c6 s-ib s-dp">
            <div className="icon-circle icon-circle-solid-primary s-fo s-xg s-r3">
              <Mic className="s-g1 s-xv" />
            </div>
            <div className="s-l8 s-c6">
              <CardTitle className="s-cy s-uk s-d3 truncate s-8i s-u9">
                {speech.title}
              </CardTitle>
              <CardDescription className="s-vj s-lt">
                {format(new Date(speech.created_at), "MMM dd, yyyy")}
              </CardDescription>
            </div>
          </div>
          <span className={`speech-row__deadline ${
            isOverdue
              ? "speech-row__deadline--overdue"
              : daysRemaining === 0
                ? "speech-row__deadline--today"
                : daysRemaining <= 3
                  ? "speech-row__deadline--soon"
                  : ""
          }`}>
            {isOverdue
              ? t(Math.abs(daysRemaining) === 1 ? 'dashboard.daysOverdue' : 'dashboard.daysOverduePlural', { count: Math.abs(daysRemaining) })
              : daysRemaining === 0
                ? t('dashboard.presentationDay', 'Presentation day!')
                : t(daysRemaining === 1 ? 'dashboard.daysLeft' : 'dashboard.daysLeftPlural', { count: daysRemaining })}
          </span>
        </div>
      </CardHeader>

      <CardContent className="speech-row__content">
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="s-g6 -ml-3 s-dn s-or s-vj s-ul s-hv"
              onClick={(e) => e.stopPropagation()}
            >
              <CalendarIcon className="s-fx s-xq" />
              <span>{t('dashboard.goal')}: {format(goalDate, "MMM dd, yyyy")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="s-y6 s-mr" align="start" onClick={(e) => e.stopPropagation()}>
            <Calendar
              mode="single"
              selected={goalDate}
              onSelect={handleDeadlineChange}
              initialFocus
              className={cn("s-mv s-nw")}
            />
          </PopoverContent>
        </Popover>

        {isLocked && nextReviewDate && (
          <div className="s-c5 s-ib s-dn s-mv s-5t s-q9">
            <Clock className="s-fz s-xt s-uw" />
            <div className="s-c6 s-vj">
              <span className="s-ul">{t('dashboard.nextPractice')} </span>
              <LockCountdown nextReviewDate={nextReviewDate} className="s-uw s-d0" />
            </div>
          </div>
        )}

        <div className="s-sy">
          <div className="s-c5 s-if s-vj">
            <span className="s-ul">{t('dashboard.progress')}</span>
            <span className="s-d0 s-u9">{progress}%</span>
          </div>
          <Progress value={progress} className="s-fw" />
          {masteryPercent !== null && (
            <div className="s-c5 s-ib s-dm s-vj">
              <Target className="s-fw s-xp s-u7" />
              <span className="s-u8 s-8q s-d0">
                {t('dashboard.mastery', 'Mastery')}: {masteryPercent}%
              </span>
            </div>
          )}
        </div>

        <p className="s-v9 s-ul s-iz s-ip">
          {stripPropCueMarkers(speech.text_original).substring(0, 140)}...
        </p>
      </CardContent>

      <CardFooter className="speech-row__footer speech-actions" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="apple"
          onClick={handleCardClick}
          className="speech-action speech-action--practice"
        >
          <Play />
          {t('dashboard.practice')}
        </Button>

        <Button
          variant="secondary"
          className="speech-action speech-action--present"
          aria-label={t('settings.subscription.presentationMode', 'Presentation Mode')}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            {
              navigate(`/presentation/${speech.id}`);
            }
          }}
        >
          <Presentation />
          <span>{t('settings.subscription.presentationMode', 'Presentation Mode')}</span>
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="speech-action speech-action--delete" aria-label={t('common.delete')}>
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="s-4b s-6x">
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dashboard.deleteSpeech')}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="s-t0">
                  <p>{t('dashboard.deleteSpeechDesc', { title: speech.title })}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="s-6x" disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                disabled={isDeleting}
                className="s-4h s-u3 s-gx"
              >
                {isDeleting ? t('dashboard.deleting') : t('common.delete')}
              </AlertDialogAction>

            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>

    </Card>
  );
};

export default SpeechCard;
