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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("speeches").insert({
        user_id: user.id,
        title,
        text_original: text,
        text_current: text,
        goal_date: goalDate,
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Your Speech</DialogTitle>
          <DialogDescription>
            Add your speech text and set a goal date for when you need to have it memorized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
