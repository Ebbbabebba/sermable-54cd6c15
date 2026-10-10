import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInfo, setFormInfo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormInfo(null);
    if (password !== confirmPassword) {
      setFormError(t('auth.passwordsMismatch'));
      return;
    }
    if (password.length < 6) {
      setFormError(t('auth.passwordTooShort'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setFormInfo(t('auth.passwordUpdatedDesc'));
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="s-l6 s-c5 s-ib s-ig s-mw">
        <Card className="s-y7 s-jq">
          <CardContent className="s-of s-u0">
            <p className="s-ul">{t('auth.invalidResetLink')}</p>
            <Button className="s-ly" onClick={() => navigate("/auth")}>{t('auth.backToSignIn')}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="s-l6 s-c5 s-ib s-ig s-mw s-oh s-nd">
      <Card className="s-y7 s-jq s-2y">
        <CardHeader className="s-sy">
          <CardTitle className="s-ta s-u0">{t('auth.setNewPassword')}</CardTitle>
          <CardDescription className="s-u0">{t('auth.setNewPasswordDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="s-t1">
            <div className="s-sy">
              <Label htmlFor="password">{t('auth.newPassword')}</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="s-sy">
              <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
              <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="s-y7" disabled={loading}>
              {loading ? (
                <><Loader2 className="s-lp s-fz s-xt s-32" />{t('auth.loading')}</>
              ) : (
                t('auth.updatePassword')
              )}
            </Button>
            {formError && (
              <p className="s-v9 s-u2 s-u0" role="alert">{formError}</p>
            )}
            {formInfo && (
              <p className="s-v9 s-u8 s-8q s-u0" role="status">{formInfo}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;