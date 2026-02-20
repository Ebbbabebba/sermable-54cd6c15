import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const useIsMobileDevice = () => {
  return useMemo(() => {
    const ua = navigator.userAgent || navigator.vendor || "";
    return /android|iphone|ipad|ipod|mobile/i.test(ua);
  }, []);
};

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get("mode") !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const isMobileDevice = useIsMobileDevice();

  useEffect(() => {
    // Desktop users cannot log in — redirect to download page
    if (!isMobileDevice) {
      navigate("/", { replace: true });
      return;
    }

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
  }, [navigate, isMobileDevice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: t('auth.welcomeBackToast'),
          description: t('auth.signInSuccess'),
        });
        const pendingToken = sessionStorage.getItem('pending-share-token');
        if (pendingToken) {
          sessionStorage.removeItem('pending-share-token');
          navigate(`/share/${pendingToken}`);
        } else {
          navigate("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        toast({
          title: t('auth.accountCreated'),
          description: t('auth.welcomeToSermable'),
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl text-center">
            {isLogin ? t('auth.welcomeBack') : t('auth.getStarted')}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin
              ? t('auth.signInToContinue')
              : t('auth.createAccount')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder={t('auth.yourName')}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
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
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('auth.loading')}
                </>
              ) : isLogin ? (
                t('auth.signIn')
              ) : (
                t('auth.signUp')
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin
                ? t('auth.noAccount')
                : t('auth.haveAccount')}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
