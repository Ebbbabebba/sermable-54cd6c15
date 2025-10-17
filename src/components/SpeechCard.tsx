import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Trash2 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  mastery_level?: number;
  speech_language?: string;
}

interface SpeechCardProps {
  speech: Speech;
  onUpdate: () => void;
}

const SpeechCard = ({ speech, onUpdate }: SpeechCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const goalDate = new Date(speech.goal_date);
  const today = new Date();
  const daysRemaining = differenceInDays(goalDate, today);
  const isOverdue = daysRemaining < 0;

  // Calculate progress from mastery level
  const progress = Math.round(speech.mastery_level || 0);
  
  const languageNames: Record<string, string> = {
    'en': 'EN',
    'sv': 'SV', 
    'es': 'ES',
    'de': 'DE',
    'fi': 'FI'
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
    <Card className="card-pinterest group overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg font-semibold leading-tight line-clamp-2 flex-1">
            {speech.title}
          </CardTitle>
          {speech.speech_language && (
            <Badge variant="secondary" className="text-xs rounded-full shrink-0">
              {languageNames[speech.speech_language] || speech.speech_language.toUpperCase()}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {format(new Date(speech.created_at), "MMM dd, yyyy")}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground font-medium">Progress</span>
            <span className="font-bold text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 progress-animate" />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span className="truncate">{format(goalDate, "MMM dd, yyyy")}</span>
          <Badge 
            variant={isOverdue ? "destructive" : "secondary"} 
            className="ml-auto text-xs rounded-full px-2 py-0"
          >
            {isOverdue ? `${Math.abs(daysRemaining)}d over` : `${daysRemaining}d`}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {speech.text_original.substring(0, 120)}...
        </p>
      </CardContent>

      <CardFooter className="pt-0 pb-4 gap-2">
        <Button
          className="flex-1 rounded-full"
          onClick={() => navigate(`/practice/${speech.id}`)}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Practice
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full shrink-0">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl">
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
