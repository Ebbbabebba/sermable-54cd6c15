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
import { lovable } from "@/integrations/lovable";


const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
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
    if (!email) {
      toast({ variant: "destructive", title: t('common.error'), description: t('auth.enterEmail') });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: t('auth.resetEmailSent'),
        description: t('auth.checkInbox'),
      });
      setIsForgotPassword(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const session = data.session ?? await waitForStableSession();
        if (!session) throw new Error(t('auth.loading'));
        toast({ title: t('auth.welcomeBackToast'), description: t('auth.signInSuccess') });
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
        toast({ title: t('auth.accountCreated'), description: t('auth.welcomeToSermable') });
        navigate("/dashboard", { replace: true });
      }
    } catch (error: any) {
      const msg: string = error?.message || '';
      const code: string = error?.code || '';
      const isInvalidCreds =
        /invalid login credentials/i.test(msg) ||
        /invalid email or password/i.test(msg) ||
        /invalid_credentials/i.test(code) ||
        error?.status === 400 ||
        error?.status === 401;
      const description = isLogin && isInvalidCreds
        ? t('auth.invalidCredentials')
        : msg;
      toast({ variant: "destructive", title: t('common.error'), description });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return;
      if (result.error) throw result.error;
      const pendingToken = sessionStorage.getItem('pending-share-token');
      if (pendingToken) {
        sessionStorage.removeItem('pending-share-token');
        navigate(`/share/${pendingToken}`, { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: t('common.error'), description: error?.message || String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="space-y-2">
            <CardTitle className="text-3xl text-center">{t('auth.resetPassword')}</CardTitle>
            <CardDescription className="text-center">{t('auth.resetPasswordDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.loading')}</>
                ) : (
                  t('auth.sendResetLink')
                )}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button type="button" onClick={() => setIsForgotPassword(false)} className="text-primary hover:underline">
                {t('auth.backToSignIn')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl text-center">
            {isLogin ? t('auth.welcomeBack') : t('auth.getStarted')}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin ? t('auth.signInToContinue') : t('auth.createAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                <Input id="fullName" type="text" placeholder={t('auth.yourName')} value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('auth.password')}</Label>
                {isLogin && (
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-primary hover:underline">
                    {t('auth.forgotPassword')}
                  </button>
                )}
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.loading')}</>
              ) : isLogin ? (
                t('auth.signIn')
              ) : (
                t('auth.signUp')
              )}
            </Button>
          </form>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground uppercase">{t('auth.orContinueWith')}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => handleOAuth('google')}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3.3 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c6.9 0 11.5-4.8 11.5-11.6 0-.8-.1-1.4-.2-2H12z"/></svg>
              {t('auth.continueWithGoogle')}
            </Button>
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => handleOAuth('apple')}>
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.365 1.43c0 1.14-.42 2.22-1.18 3.02-.82.87-2.14 1.55-3.23 1.46-.14-1.11.42-2.27 1.16-3.04.84-.87 2.27-1.52 3.25-1.44zM20.5 17.36c-.55 1.27-.81 1.84-1.52 2.97-.99 1.58-2.39 3.55-4.12 3.56-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.06-1.79-4.05-3.37C-.04 16.06-.34 10.92 1.86 8.16c1.56-1.96 4.02-3.11 6.33-3.11 2.35 0 3.83 1.29 5.78 1.29 1.89 0 3.04-1.29 5.76-1.29 2.06 0 4.24 1.12 5.79 3.06-5.09 2.79-4.26 10.06-4.02 9.25z"/></svg>
              {t('auth.continueWithApple')}
            </Button>
          </div>
          <div className="mt-4 text-center text-sm">
            <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-primary hover:underline">
              {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}
            </button>
          </div>
        </CardContent>
    </Card>
    </div>
  );
};

export default Auth;
