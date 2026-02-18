import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SharedSpeechData {
  title: string;
  text_original: string;
  goal_date: string | null;
  speech_type: string | null;
  speech_language: string | null;
}

const SharedSpeech = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [speech, setSpeech] = useState<SharedSpeechData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      await fetchSpeech();
    };
    init();
  }, [token]);

  const fetchSpeech = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-shared-speech', {
        body: { share_token: token },
      });

      if (error || !data?.speech) {
        setError(true);
        return;
      }
      setSpeech(data.speech);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!speech) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Save token and redirect to auth
      sessionStorage.setItem('pending-share-token', token || '');
      navigate('/auth');
      return;
    }

    setImporting(true);
    try {
      const { error } = await supabase.from('speeches').insert({
        user_id: session.user.id,
        title: speech.title,
        text_original: speech.text_original,
        text_current: speech.text_original,
        goal_date: speech.goal_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        speech_type: speech.speech_type || 'general',
        speech_language: speech.speech_language || 'en',
      });

      if (error) throw error;

      toast({ title: "Speech imported!", description: `"${speech.title}" has been added to your speeches.` });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !speech) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-0 shadow-apple-xl">
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Speech not found</h2>
            <p className="text-muted-foreground">This share link may have expired or been removed.</p>
            <Button variant="apple" onClick={() => navigate('/')}>Go to Sermable</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const wordCount = speech.text_original.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-lg w-full border-0 shadow-apple-xl">
        <CardHeader className="text-center pb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Shared Speech</p>
          <CardTitle className="text-2xl capitalize">{speech.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-6 text-sm text-muted-foreground">
            <span>{wordCount} words</span>
            {speech.speech_type && <span className="capitalize">{speech.speech_type}</span>}
          </div>

          <div className="bg-muted/50 rounded-xl p-4 max-h-48 overflow-y-auto">
            <p className="text-sm text-foreground/80 leading-relaxed">
              {speech.text_original.substring(0, 500)}
              {speech.text_original.length > 500 && '...'}
            </p>
          </div>

          <div className="space-y-3">
            <Button variant="apple" size="lg" className="w-full" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isLoggedIn ? 'Add to My Speeches' : 'Sign Up & Add Speech'}
            </Button>

            {!isLoggedIn && (
              <p className="text-xs text-muted-foreground text-center">
                Create a free account to start practicing this speech
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedSpeech;