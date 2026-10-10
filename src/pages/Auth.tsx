import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { waitForStableSession } from "@/lib/authSession";


const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const pendingToken = sessionStorage.getItem('pending-share-token');
        if (pendingToken) {
          sessionStorage.removeItem('pending-share-token');
          navigate(`/share/${pendingToken}`);
        } else {
          navigate("/dashboard");
        }
      }
    };
    checkUser();
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);
    if (!email) {
      setFormError(t('auth.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setFormInfo(`${t('auth.resetEmailSent')} — ${t('auth.checkInbox')}`);
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const session = data.session ?? await waitForStableSession();
        if (!session) throw new Error(t('auth.loading'));
        const pendingToken = sessionStorage.getItem('pending-share-token');
        if (pendingToken) {
          sessionStorage.removeItem('pending-share-token');
          navigate(`/share/${pendingToken}`, { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        await waitForStableSession();
        navigate("/dashboard", { replace: true });
      }
    } catch (error: any) {
      const msg: string = error?.message || '';
      const isInvalidCreds =
        /invalid login credentials/i.test(msg) ||
        /invalid email or password/i.test(msg) ||
        error?.status === 400;
      const description = isLogin && isInvalidCreds
        ? t('auth.invalidCredentials')
        : msg;
      setFormError(description);
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="s-l6 s-c5 s-ib s-ig s-mw s-oh s-nd">
        <Card className="s-y7 s-jq s-2y">
          <CardHeader className="s-sy">
            <CardTitle className="s-ta s-u0">{t('auth.resetPassword')}</CardTitle>
            <CardDescription className="s-u0">{t('auth.resetPasswordDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="s-t1">
              <div className="s-sy">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="s-y7" disabled={loading}>
                {loading ? (
                  <><Loader2 className="s-lp s-fz s-xt s-32" />{t('auth.loading')}</>
                ) : (
                  t('auth.sendResetLink')
                )}
              </Button>
              {formError && (
                <p className="s-v9 s-u2 s-u0" role="alert">{formError}</p>
              )}
              {formInfo && (
                <p className="s-v9 s-u8 s-8q s-u0" role="status">{formInfo}</p>
              )}
            </form>
            <div className="s-ly s-u0 s-v9">
              <button type="button" onClick={() => setIsForgotPassword(false)} className="s-uw s-i1">
                {t('auth.backToSignIn')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="s-l6 s-c5 s-ib s-ig s-mw s-oh s-nd">
      <Card className="s-y7 s-jq s-2y">
        <CardHeader className="s-sy">
          <CardTitle className="s-ta s-u0">
            {isLogin ? t('auth.welcomeBack') : t('auth.getStarted')}
          </CardTitle>
          <CardDescription className="s-u0">
            {isLogin ? t('auth.signInToContinue') : t('auth.createAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="s-t1">
            {!isLogin && (
              <div className="s-sy">
                <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                <Input id="fullName" type="text" placeholder={t('auth.yourName')} value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} />
              </div>
            )}
            <div className="s-sy">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="s-sy">
              <div className="s-c5 s-ib s-if">
                <Label htmlFor="password">{t('auth.password')}</Label>
                {isLogin && (
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="s-vj s-uw s-i1">
                    {t('auth.forgotPassword')}
                  </button>
                )}
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="s-y7" disabled={loading}>
              {loading ? (
                <><Loader2 className="s-lp s-fz s-xt s-32" />{t('auth.loading')}</>
              ) : isLogin ? (
                t('auth.signIn')
              ) : (
                t('auth.signUp')
              )}
            </Button>
            {formError && (
              <p className="s-v9 s-u2 s-u0" role="alert">{formError}</p>
            )}
            {formInfo && (
              <p className="s-v9 s-u8 s-8q s-u0" role="status">{formInfo}</p>
            )}
          </form>
          <div className="s-ly s-u0 s-v9">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="s-uw s-i1">
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
            </button>
          </div>
        </CardContent>
    </Card>
    </div>
  );
};

export default Auth;
