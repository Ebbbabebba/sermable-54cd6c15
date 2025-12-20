import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Trash2, Presentation, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [nextReviewDate, setNextReviewDate] = useState<Date | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  // Calculate memorization progress based on how many words have been mastered
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

  const handleCardClick = () => {
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

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate capitalize">{speech.title}</CardTitle>
            <CardDescription className="mt-1">
              {t('dashboard.created')} {format(new Date(speech.created_at), "MMM dd, yyyy")}
            </CardDescription>
          </div>
          <Badge variant={isOverdue ? "destructive" : "secondary"}>
            {isOverdue
              ? t(Math.abs(daysRemaining) === 1 ? 'dashboard.daysOverdue' : 'dashboard.daysOverduePlural', { count: Math.abs(daysRemaining) })
              : t(daysRemaining === 1 ? 'dashboard.daysLeft' : 'dashboard.daysLeftPlural', { count: daysRemaining })}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{t('dashboard.goal')}: {format(goalDate, "MMM dd, yyyy")}</span>
        </div>

        {isLocked && nextReviewDate && (
          <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <Clock className="h-4 w-4 text-primary" />
            <div className="flex-1">
              <span className="text-sm">{t('dashboard.nextPractice')} </span>
              <LockCountdown nextReviewDate={nextReviewDate} className="text-primary font-medium text-sm" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('dashboard.progress')}</span>
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
          {t('dashboard.practice')}
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate(`/presentation/${speech.id}`)}
        >
          <Presentation className="h-4 w-4 mr-2" />
          {t('dashboard.present')}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dashboard.deleteSpeech')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dashboard.deleteSpeechDesc', { title: speech.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};

export default SpeechCard;
