import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface UploadSpeechDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const UploadSpeechDialog = ({ open, onOpenChange, onSuccess }: UploadSpeechDialogProps) => {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState("en");
  const [familiarityLevel, setFamiliarityLevel] = useState("new");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Set initial mastery based on familiarity
      let initialMastery = 0;
      if (familiarityLevel === "familiar") {
        initialMastery = 30;
      } else if (familiarityLevel === "well_known") {
        initialMastery = 60;
      }

      const { error } = await supabase.from("speeches").insert({
        user_id: user.id,
        title,
        text_original: text,
        text_current: text,
        goal_date: goalDate,
        speech_language: speechLanguage,
        familiarity_level: familiarityLevel,
        mastery_level: initialMastery
      });

      if (error) throw error;

      toast({
        title: "Speech uploaded!",
        description: "Your speech has been saved. Time to start practicing!",
      });

      // Reset form
      setTitle("");
      setText("");
      setGoalDate("");
      setSpeechLanguage("en");
      setFamiliarityLevel("new");
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get minimum date (today)
  const minDate = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Upload Your Speech</DialogTitle>
          <DialogDescription>
            Add your speech text and set a goal date for when you need to have it memorized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <Label htmlFor="title">Speech Title</Label>
            <Input
              id="title"
              placeholder="e.g., Quarterly Business Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalDate">Goal Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="goalDate"
                type="date"
                className="pl-10"
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                min={minDate}
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              When do you need to deliver this speech?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="speechLanguage">Speech Language</Label>
            <select
              id="speechLanguage"
              value={speechLanguage}
              onChange={(e) => setSpeechLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              required
            >
              <option value="en">English</option>
              <option value="sv">Swedish</option>
              <option value="es">Spanish</option>
              <option value="de">German</option>
              <option value="fi">Finnish</option>
            </select>
            <p className="text-sm text-muted-foreground">
              What language is your speech in?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="familiarityLevel">How familiar are you with this text?</Label>
            <select
              id="familiarityLevel"
              value={familiarityLevel}
              onChange={(e) => setFamiliarityLevel(e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              required
            >
              <option value="new">This text is completely new to me</option>
              <option value="familiar">I know a bit about this text</option>
              <option value="well_known">I already know this text quite well</option>
            </select>
            <p className="text-sm text-muted-foreground">
              We'll adapt the learning process based on your familiarity.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">Speech Text</Label>
            <Textarea
              id="text"
              placeholder="Paste your speech text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              required
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              {text.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload Speech"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSpeechDialog;
