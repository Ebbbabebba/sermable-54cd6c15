import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Trash2, Loader2, User, Shield, Lock, Eye, EyeOff, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AccountSettings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('settings.account.passwordTooShort', 'Password must be at least 6 characters'),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('settings.account.passwordMismatch', 'Passwords do not match'),
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: t('common.success', 'Success'),
        description: t('settings.account.passwordChanged', 'Your password has been updated'),
      });
      setNewPassword("");
      setConfirmPassword("");
      setPasswordChanged(true);
      setTimeout(() => setPasswordChanged(false), 5000);
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: t('common.error'),
          description: t('settings.account.notLoggedIn'),
          variant: "destructive",
        });
        return;
      }

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

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      await supabase.auth.signOut();
      toast({
        title: t('settings.account.deleted'),
        description: t('settings.account.deletedDesc'),
      });
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: t('common.error'),
        description: t('settings.account.deleteFailed'),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="s-l6 s-3v">
      {/* Header */}
      <header className="s-t7 s-w1 s-yh s-43 s-3d s-t8 s-6v" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="s-jc s-m9 s-os s-p6 s-c5 s-ib s-dp">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="s-g1 s-xv" />
          </Button>
          <h1 className="s-uk s-d3">{t('settings.account.title')}</h1>
        </div>
      </header>

      <main className="s-jc s-m9 s-os s-p7 s-t0">
        {/* Combined Info Card */}
        <Card>
          <CardContent className="s-od s-t0">
            <div className="s-c5 s-id s-dp">
              <User className="s-g1 s-xv s-uw s-ls" />
              <div>
                <p className="s-d0 s-v9">{t('settings.account.personalizedLearning')}</p>
                <p className="s-vj s-ul">{t('settings.account.personalizedLearningDesc')}</p>
              </div>
            </div>
            <div className="s-c5 s-id s-dp">
              <Shield className="s-g1 s-xv s-uw s-ls" />
              <div>
                <p className="s-d0 s-v9">{t('settings.account.dataPrivacy')}</p>
                <p className="s-vj s-ul">{t('settings.account.dataPrivacyDesc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader className="s-n4">
            <div className="s-c5 s-ib s-dn">
              <Lock className="s-g1 s-xv s-uw" />
              <CardTitle className="s-tw">{t('settings.account.changePassword', 'Change Password')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="s-t0">
            <div className="s-sx">
              <Label htmlFor="new-password" className="s-vj">{t('settings.account.newPassword', 'New password')}</Label>
              <div className="s-pd">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
                <button
                  type="button"
                  className="s-26 s-ph s-w4 s-9 s-ul s-hv"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="s-fz s-xt" /> : <Eye className="s-fz s-xt" />}
                </button>
              </div>
            </div>
            <div className="s-sx">
              <Label htmlFor="confirm-password" className="s-vj">{t('settings.account.confirmPassword', 'Confirm password')}</Label>
              <div className="s-pd">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                />
                <button
                  type="button"
                  className="s-26 s-ph s-w4 s-9 s-ul s-hv"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="s-fz s-xt" /> : <Eye className="s-fz s-xt" />}
                </button>
              </div>
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || !confirmPassword}
              className="s-y7"
              size="sm"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="s-fz s-xt s-lp s-32" />
                  {t('common.loading')}
                </>
              ) : (
                t('settings.account.updatePassword', 'Update Password')
              )}
            </Button>
            {passwordChanged && (
              <div className="s-c5 s-ib s-dn s-mv s-qh s-4w s-6l s-7d s-2y">
                <CheckCircle2 className="s-g1 s-xv s-ud s-r5" />
                <p className="s-v9 s-d0 s-ue s-8s">
                  {t('settings.account.passwordChanged', 'Your password has been updated')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Danger Zone */}
        <Card className="s-79">
          <CardContent className="s-od">
            <div className="s-c5 s-ib s-dn s-jy">
              <Trash2 className="s-fz s-xt s-u2" />
              <p className="s-d0 s-v9 s-u2">{t('settings.account.dangerZone')}</p>
            </div>
            <p className="s-vj s-ul s-jz">{t('settings.account.dangerZoneDesc')}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="s-y7" disabled={isDeleting}>
                  {isDeleting ? (
                    <>
                      <Loader2 className="s-fz s-xt s-lp s-32" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="s-fz s-xt s-lp" />
                      {t('settings.account.deleteAccount')}
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.account.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.account.deleteConfirmDesc')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="s-4h s-u3 s-gx"
                  >
                    {t('settings.account.confirmDelete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Deletion Request Link */}
        <div className="s-u0 s-o9">
          <button
            onClick={() => navigate('/delete-account')}
            className="s-vj s-ul s-wy s-hv s-ws"
          >
            {t('settings.account.requestDeletion', 'Request account & data deletion')}
          </button>
        </div>
      </main>
    </div>
  );
};

export default AccountSettings;
