import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const DeleteAccountRequest = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      // Try to sign in - if user is already logged in, delete directly
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user.email === email) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          await supabase.auth.signOut();
          setSubmitted(true);
          return;
        }
      }

      // If not logged in or different email, just show confirmation
      setSubmitted(true);
      toast({
        title: t('deleteAccount.requestReceived'),
        description: t('deleteAccount.requestReceivedToastDesc'),
      });
    } catch (error) {
      console.error('Error:', error);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="s-l6 s-3v s-c5 s-ib s-ig s-mw" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <Card className="s-y7 s-jq s-pd">
        <CardHeader className="s-u0">
          <Button variant="ghost" size="icon" className="s-26 s-iw s-w8" onClick={() => window.history.back()}>
            <ArrowLeft className="s-g1 s-xv" />
          </Button>
          <Trash2 className="s-fn s-xf s-u2 s-m9 s-jy" />
          <CardTitle className="s-vi">{t('deleteAccount.title')}</CardTitle>
          <CardDescription>
            {t('deleteAccount.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="s-u0 s-t1">
              <CheckCircle2 className="s-fp s-xh s-ud s-m9" />
              <div>
                <p className="s-d0">{t('deleteAccount.requestReceived')}</p>
                <p className="s-v9 s-ul s-lt">
                  {t('deleteAccount.submittedDesc')}
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')} className="s-ly">
                {t('deleteAccount.goHome')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="s-t1">
              <div className="s-sy">
                <Label htmlFor="email">{t('deleteAccount.emailAddress')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="s-vj s-ul">
                {t('deleteAccount.warning')}
              </p>
              <Button
                type="submit"
                variant="destructive"
                className="s-y7"
                disabled={isSubmitting || !email}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="s-fz s-xt s-lp s-32" />
                    {t('deleteAccount.processing')}
                  </>
                ) : (
                  t('deleteAccount.submit')
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeleteAccountRequest;
