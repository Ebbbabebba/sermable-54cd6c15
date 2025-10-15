import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Globe } from "lucide-react";

const LanguagePreference = () => {
  const [feedbackLanguage, setFeedbackLanguage] = useState("sv");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPreference();
  }, []);

  const loadPreference = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from('profiles')
        .select('feedback_language')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (data?.feedback_language) {
        setFeedbackLanguage(data.feedback_language);
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ feedback_language: newLanguage })
        .eq('id', userData.user.id);

      if (error) throw error;

      setFeedbackLanguage(newLanguage);
      toast({
        title: "Language updated",
        description: "Your feedback language preference has been saved.",
      });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          <div>
            <CardTitle>Language Preferences</CardTitle>
            <CardDescription>
              Choose your preferred language for feedback
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feedbackLanguage">Feedback Language</Label>
          <select
            id="feedbackLanguage"
            value={feedbackLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            <option value="en">English</option>
            <option value="sv">Swedish</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="fi">Finnish</option>
          </select>
          <p className="text-sm text-muted-foreground">
            AI will provide feedback and analysis in this language, regardless of your speech language
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LanguagePreference;
