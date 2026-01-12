import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Calendar, Play, Trash2, Theater, Clock } from "lucide-react";
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
              : "bg-secondary text-muted-foreground"
          }`}>
            {isOverdue
              ? t(Math.abs(daysRemaining) === 1 ? 'dashboard.daysOverdue' : 'dashboard.daysOverduePlural', { count: Math.abs(daysRemaining) })
              : t(daysRemaining === 1 ? 'dashboard.daysLeft' : 'dashboard.daysLeftPlural', { count: daysRemaining })}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{t('dashboard.goal')}: {format(goalDate, "MMM dd, yyyy")}</span>
        </div>

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
          size="sm"
          onClick={() => navigate(`/presentation/${speech.id}`)}
        >
          <Theater className="h-4 w-4" />
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
              <AlertDialogDescription>
                {t('dashboard.deleteSpeechDesc', { title: speech.title })}
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
    </Card>
  );
};

export default SpeechCard;
