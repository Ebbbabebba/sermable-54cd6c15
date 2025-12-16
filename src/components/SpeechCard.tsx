import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Trash2, Presentation } from "lucide-react";
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

  // Calculate memorization progress based on how many words have been mastered
  const originalWords = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;
  const currentWords = speech.text_current.split(/\s+/).filter(w => w.length > 0).length;
  const wordsMemorized = Math.max(0, originalWords - currentWords);
  const progress = originalWords > 0 ? Math.round((wordsMemorized / originalWords) * 100) : 0;

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
  );
};

export default SpeechCard;
