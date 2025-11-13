import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, Languages, Brain } from "lucide-react";
import { format } from "date-fns";
import { switchLanguageBasedOnText } from "@/utils/languageDetection";

interface UploadSpeechDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const UploadSpeechDialog = ({ open, onOpenChange, onSuccess }: UploadSpeechDialogProps) => {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [familiarityLevel, setFamiliarityLevel] = useState<string>("beginner");
  const [loading, setLoading] = useState(false);
  const [userTier, setUserTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [wordLimit, setWordLimit] = useState(500);
  const [canCreateSpeech, setCanCreateSpeech] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadUserLimits = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get user profile with subscription info
        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier, monthly_speeches_count, monthly_speeches_reset_date")
          .eq("id", user.id)
          .single();

        if (profile) {
          setUserTier(profile.subscription_tier);
          
          // Get word limit
          const { data: limitData } = await supabase.rpc('get_word_limit', { 
            p_user_id: user.id 
          });
          if (limitData) setWordLimit(limitData);

          // Check if user can create speech
          const { data: canCreate } = await supabase.rpc('can_create_speech', { 
            p_user_id: user.id 
          });
          if (canCreate !== null) setCanCreateSpeech(canCreate);
        }
      } catch (error) {
        console.error('Error loading user limits:', error);
      }
    };

    if (open) {
      loadUserLimits();
    }
  }, [open]);

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Auto-detect language and switch if different
    if (newText.length > 50) {
      const languageSwitched = switchLanguageBasedOnText(
        newText,
        i18n.language,
        i18n.changeLanguage
      );
      
      if (languageSwitched) {
        toast({
          title: t('common.success'),
          description: `${t('upload.languageDetected')} (${i18n.language.toUpperCase()})`,
          duration: 3000,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check word count
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > wordLimit) {
      toast({
        variant: "destructive",
        title: t('upload.error'),
        description: `Your speech has ${wordCount} words. ${userTier === 'free' ? 'Free plan' : 'Your plan'} allows up to ${wordLimit} words. ${userTier === 'free' ? 'Upgrade to premium for up to 5000 words.' : ''}`,
      });
      return;
    }

    if (!canCreateSpeech) {
      toast({
        variant: "destructive",
        title: t('upload.limitReached'),
        description: "You've reached your monthly speech limit. Free users can create 2 speeches per month. Upgrade to premium for unlimited speeches.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: newSpeech, error } = await supabase.from("speeches").insert({
        user_id: user.id,
        title,
        text_original: text,
        text_current: text,
        goal_date: goalDate,
        familiarity_level: familiarityLevel,
      }).select().single();

      if (error) throw error;

      // Check memorization feasibility
      const { data: feasibilityData, error: feasibilityError } = await supabase
        .rpc('assess_memorization_feasibility', { p_speech_id: newSpeech.id });

      if (!feasibilityError && feasibilityData && feasibilityData.length > 0) {
        const assessment = feasibilityData[0];
        
        // Show appropriate warning based on warning level
        if (assessment.warning_level === 'critical' || assessment.warning_level === 'emergency') {
          toast({
            variant: "destructive",
            title: "⚠️ Tight Deadline Warning",
            description: assessment.message,
            duration: 8000,
          });
        } else if (assessment.warning_level === 'challenging') {
          toast({
            title: "🔥 Intensive Practice Required",
            description: assessment.message,
            duration: 6000,
          });
        } else if (assessment.warning_level === 'tight') {
          toast({
            title: "⏰ Stay Consistent",
            description: assessment.message,
            duration: 5000,
          });
        } else {
          toast({
            title: t('upload.success'),
            description: "Your speech has been saved. Time to start practicing!",
          });
        }
      } else {
        toast({
          title: t('upload.success'),
          description: "Your speech has been saved. Time to start practicing!",
        });
      }

      // Reset form
      setTitle("");
      setText("");
      setGoalDate("");
      setFamiliarityLevel("beginner");
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('upload.error'),
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('upload.title')}</DialogTitle>
          <DialogDescription>
            Add your speech text and set a goal date for when you need to have it memorized.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="title">{t('upload.speechTitle')}</Label>
            <Input
              id="title"
              placeholder="e.g., Quarterly Business Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalDate">{t('upload.goalDate')}</Label>
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
            <div className="flex items-center gap-2">
              <Label htmlFor="familiarity">How well do you know this text?</Label>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={familiarityLevel} onValueChange={setFamiliarityLevel}>
              <SelectTrigger id="familiarity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">I don't know it at all</SelectItem>
                <SelectItem value="intermediate">I know some parts</SelectItem>
                <SelectItem value="confident">I know it very well</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              This helps us adjust the difficulty level for your practice sessions
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="text">{t('upload.speechText')}</Label>
              <Languages className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Auto-detects language
              </span>
            </div>
            <Textarea
              id="text"
              placeholder={t('upload.pasteText')}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              rows={12}
              required
              className="resize-none"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {text.split(/\s+/).filter(Boolean).length} / {wordLimit} {t('dashboard.words')}
              </span>
              {userTier === 'free' && (
                <span className="text-xs text-muted-foreground">
                  {t('upload.wordLimit')}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('upload.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('upload.uploading')}
                </>
              ) : (
                t('upload.upload')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadSpeechDialog;
