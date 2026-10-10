import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileText, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { stripPropCueMarkers } from "@/utils/propCues";

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
  const { t } = useTranslation();
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

      toast({ title: t('sharedSpeech.imported'), description: t('sharedSpeech.importedDesc', { title: speech.title }) });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ variant: "destructive", title: t('sharedSpeech.importFailed'), description: err.message });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="s-l6 s-3v s-c5 s-ib s-ig">
        <Loader2 className="s-g6 s-y0 s-32 s-uw" />
      </div>
    );
  }

  if (error || !speech) {
    return (
      <div className="s-l6 s-3v s-c5 s-ib s-ig s-my">
        <Card className="s-jq s-y7 s-6m shadow-apple-xl">
          <CardContent className="s-p1 s-u0 s-t1">
            <FileText className="s-fp s-xh s-ul s-m9" />
            <h2 className="s-vi s-d3 s-u9">{t('sharedSpeech.notFound')}</h2>
            <p className="s-ul">{t('sharedSpeech.notFoundDesc')}</p>
            <Button variant="apple" onClick={() => navigate('/')}>{t('sharedSpeech.goToApp')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cleanSpeechText = stripPropCueMarkers(speech.text_original);
  const wordCount = cleanSpeechText.split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="s-l6 s-3v s-c5 s-ib s-ig s-my">
      <Card className="s-jo s-y7 s-6m shadow-apple-xl">
        <CardHeader className="s-u0 s-n4">
          <p className="s-vj s-ul s-x1 s-wj s-jy">{t('sharedSpeech.sharedSpeech')}</p>
          <CardTitle className="s-t9 s-8i">{speech.title}</CardTitle>
        </CardHeader>
        <CardContent className="s-t3">
          <div className="s-c5 s-ig s-ds s-v9 s-ul">
            <span>{wordCount} {t('common.words')}</span>
            {speech.speech_type && <span className="s-8i">{speech.speech_type}</span>}
          </div>

          <div className="s-56 s-qo s-mw s-j5 s-mq">
            <p className="s-v9 s-ub s-ip">
              {cleanSpeechText.substring(0, 500)}
              {cleanSpeechText.length > 500 && '...'}
            </p>
          </div>

          <div className="s-t0">
            <Button variant="apple" size="lg" className="s-y7" onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="s-fz s-xt s-32" /> : <Download className="s-fz s-xt" />}
              {isLoggedIn ? t('sharedSpeech.addToMySpeeches') : t('sharedSpeech.signUpAndAdd')}
            </Button>

            {!isLoggedIn && (
              <p className="s-vj s-ul s-u0">
                {t('sharedSpeech.createAccountHint')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SharedSpeech;