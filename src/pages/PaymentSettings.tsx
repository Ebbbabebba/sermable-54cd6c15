import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown, Check, Zap, FileStack, Presentation, BarChart3, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isIOSNativeApp, triggerNativeIAP, getNativePrices, installPurchaseListener } from "@/lib/iosBridge";
import { getLocalizedFallbackPrices } from "@/lib/localizedPricing";
import type { Database } from "@/integrations/supabase/types";
import { FORCE_PREMIUM } from "@/lib/premiumOverride";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

const PaymentSettings = () => {
  const navigate = useNavigate();
  // Payments are disabled — no plans to show.
  useEffect(() => {
    if (FORCE_PREMIUM) navigate("/settings", { replace: true });
  }, [navigate]);
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [purchaseState, setPurchaseState] = useState<'idle' | 'processing' | 'verifying' | 'success' | 'error'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const isIOS = isIOSNativeApp();
  const fallbackPrices = getLocalizedFallbackPrices();
  const [prices, setPrices] = useState<{ monthly?: string; yearly?: string }>(getNativePrices());

  const isPremium = subscriptionTier !== 'free';

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile?.subscription_tier) {
          setSubscriptionTier(profile.subscription_tier);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Fetch localized App Store prices and listen for native updates
  useEffect(() => {
    if (!isIOS) return;
    triggerNativeIAP('fetchPrices');
    const onUpdate = () => setPrices({ ...getNativePrices() });
    window.addEventListener('iap-prices-updated', onUpdate);
    return () => window.removeEventListener('iap-prices-updated', onUpdate);
  }, [isIOS]);

  // Helper: re-check subscription status from backend (fallback verification)
  const checkSubscriptionStatus = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    if (profile?.subscription_tier) {
      setSubscriptionTier(profile.subscription_tier);
      return profile.subscription_tier !== 'free';
    }
    return false;
  };

  // Listen for successful native purchases and verify with backend
  useEffect(() => {
    if (!isIOS) return;
    const cleanup = installPurchaseListener(async (result) => {
      setPurchaseState('verifying');
      if (result.success && result.active) {
        const isPrem = await checkSubscriptionStatus();
        if (isPrem) {
          setPurchaseState('success');
          setPurchaseError(null);
          toast({
            title: t('paymentSettings.welcomePremium'),
            description: t('paymentSettings.subActive'),
          });
        } else {
          // Backend says verified but profile not yet updated — retry once
          await new Promise(r => setTimeout(r, 1500));
          const retry = await checkSubscriptionStatus();
          if (retry) {
            setPurchaseState('success');
          } else {
            setPurchaseState('error');
            setPurchaseError(t('paymentSettings.payReceivedNotUpgraded'));
          }
        }
      } else {
        setPurchaseState('error');
        setPurchaseError(result.error ?? t('paymentSettings.verifyFailedGeneric'));
        toast({
          title: t('paymentSettings.verificationFailed'),
          description: result.error ?? t('paymentSettings.tryAgainContact'),
          variant: "destructive",
        });
      }
    });
    const onFail = (e: Event) => {
      const detail = (e as CustomEvent<{ reason?: string }>).detail;
      if (detail?.reason === 'userCancelled') {
        setPurchaseState('idle');
        return;
      }
      setPurchaseState('error');
      setPurchaseError(detail?.reason ?? t('paymentSettings.tryAgain'));
      toast({
        title: t('paymentSettings.purchaseFailed'),
        description: detail?.reason ?? t('paymentSettings.tryAgain'),
        variant: "destructive",
      });
    };
    window.addEventListener('iap-purchase-failed', onFail);
    return () => {
      cleanup();
      window.removeEventListener('iap-purchase-failed', onFail);
    };
  }, [isIOS, toast, t]);

  const handleUpgrade = () => {
    if (isIOS) {
      setPurchaseState('processing');
      setPurchaseError(null);
      triggerNativeIAP(selectedPlan === 'yearly' ? 'buyYearly' : 'buyMonthly');
      return;
    }

    toast({
      title: t('paymentSettings.upgradeIniOS'),
      description: t('paymentSettings.subsInApp'),
    });
  };

  const handleRestore = async () => {
    if (!isIOS) return;
    setPurchaseState('verifying');
    triggerNativeIAP('restorePurchases');
    toast({ title: t('paymentSettings.restoring') });
    // After 4s, fall back to checking subscription directly from backend
    setTimeout(async () => {
      const isPrem = await checkSubscriptionStatus();
      if (isPrem) {
        setPurchaseState('success');
        toast({ title: t('paymentSettings.premiumRestored') });
      } else {
        setPurchaseState('idle');
      }
    }, 4000);
  };

  return (
    <div className="s-l6 s-3v">
      <header className="s-6v s-4b s-t7 s-w1 s-ye" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="s-8j s-m9 s-os s-p7">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <ArrowLeft className="s-fz s-xt s-lp" />
            {t('common.back')}
          </Button>
        </div>
      </header>

      <main className="s-8j s-m9 s-os s-pb s-jc">
        <div className="s-t3">
          <div className="s-2y">
            <h1 className="s-tb s-cx s-jy">{t('paymentSettings.pageTitle')}</h1>
            <p className="s-ul">
              {t('paymentSettings.pageSubtitle')}
            </p>
          </div>

          {isPremium ? (
            <Card className="s-6m s-5e">
              <CardHeader>
                <div className="s-c5 s-ib s-dp">
                  <div className="s-mu s-qo s-5c s-qx">
                    <Crown className="s-g1 s-xv s-vg" />
                  </div>
                  <div>
                    <CardTitle>{t('paymentSettings.youArePremium')}</CardTitle>
                    <CardDescription>
                      {t('paymentSettings.manageInApple')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="s-y7"
                  onClick={() => {
                    window.open('https://apps.apple.com/account/subscriptions', '_blank');
                  }}
                >
                  <ExternalLink className="s-fz s-xt s-lp" />
                  {t('paymentSettings.manageInAppStore')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="s-6m s-5e s-mn s-pd">
              <div className="s-26 s-w1 s-pe s-xs s-fy s-5e s-qe s-6k" />

              <CardHeader className="s-pd s-n4">
                <div className="s-c5 s-ib s-dp">
                  <div className="s-mu s-qo s-5c s-qx">
                    <Crown className="s-g1 s-xv s-ux" />
                  </div>
                  <div>
                    <CardTitle className="s-vi">{t('paymentSettings.upgradeTitle')}</CardTitle>
                    <CardDescription className="s-vj">
                      {t('paymentSettings.upgradeDesc')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="s-t2 s-pd">
                <div className="s-e0 s-e2 s-dp">
                  <div className="s-c5 s-id s-do s-mv s-qo s-4e s-6l">
                    <div className="s-mt s-qh s-5e s-r5">
                      <FileStack className="s-fz s-xt s-uw" />
                    </div>
                    <p className="s-v9 s-d0">{t('paymentSettings.featUnlimited')}</p>
                  </div>
                  <div className="s-c5 s-id s-do s-mv s-qo s-4e s-6l">
                    <div className="s-mt s-qh s-3q s-r5">
                      <Presentation className="s-fz s-xt s-tr" />
                    </div>
                    <p className="s-v9 s-d0">{t('paymentSettings.featPresentation')}</p>
                  </div>
                  <div className="s-c5 s-id s-do s-mv s-qo s-4e s-6l">
                    <div className="s-mt s-qh s-5e s-r5">
                      <Zap className="s-fz s-xt s-uw" />
                    </div>
                    <p className="s-v9 s-d0">{t('paymentSettings.featAnytime')}</p>
                  </div>
                  <div className="s-c5 s-id s-do s-mv s-qo s-4e s-6l">
                    <div className="s-mt s-qh s-3q s-r5">
                      <BarChart3 className="s-fz s-xt s-tr" />
                    </div>
                    <p className="s-v9 s-d0">{t('paymentSettings.featAnalytics')}</p>
                  </div>
                </div>

                <div className="s-t0 s-o9">
                  <button
                    onClick={() => setSelectedPlan('yearly')}
                    className={`s-y7 s-mw s-q9 s-wr s-uj s-pd s-mn ${
                      selectedPlan === 'yearly'
                        ? 's-5c s-ux s-qx s-r0'
                        : 's-4b s-6n s-6x s-hi'
                    }`}
                  >
                    <div className={`s-26 s-w6 s-ph s-vj s-op s-ox s-qe s-d0 ${
                      selectedPlan === 'yearly' ? 's-5d s-ux' : 's-5c s-ux'
                    }`}>
                      {t('paymentSettings.bestValue')}
                    </div>
                    <p className="s-v9 s-d0 s-mj">{t('paymentSettings.yearly')}</p>
                    <div className="s-c5 s-ia s-dn s-lt">
                      <p className="s-ta s-cx">{prices.yearly ?? fallbackPrices.yearly}</p>
                      <p className="s-v9 s-mi">{t('paymentSettings.perYear')}</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`s-y7 s-mw s-q9 s-wr s-uj ${
                      selectedPlan === 'monthly'
                        ? 's-5c s-ux s-qx s-r0'
                        : 's-4b s-6n s-6x s-hi'
                    }`}
                  >
                    <p className="s-v9 s-d0 s-mj">{t('paymentSettings.monthly')}</p>
                    <div className="s-c5 s-ia s-dn s-lt">
                      <p className="s-ta s-cx">{prices.monthly ?? fallbackPrices.monthly}</p>
                      <p className="s-v9 s-mi">{t('paymentSettings.perMonth')}</p>
                    </div>
                  </button>
                </div>

                <Button
                  size="lg"
                  className="s-y7 s-5c s-vg"
                  onClick={handleUpgrade}
                  disabled={purchaseState === 'processing' || purchaseState === 'verifying'}
                >
                  {purchaseState === 'processing' || purchaseState === 'verifying' ? (
                    <>
                      <Loader2 className="s-fz s-xt s-lp s-32" />
                      {purchaseState === 'verifying' ? t('paymentSettings.verifying') : t('paymentSettings.processing')}
                    </>
                  ) : (
                    <>
                      <Crown className="s-fz s-xt s-lp" />
                      {isIOS ? t('paymentSettings.subscribe') : t('paymentSettings.getPremium')}
                    </>
                  )}
                </Button>

                {purchaseState === 'error' && purchaseError && (
                  <div className="s-c5 s-id s-dn s-mv s-qh s-4i s-6l s-76 s-v9 s-u2">
                    <AlertCircle className="s-fz s-xt s-ls s-r5" />
                    <p>{purchaseError}</p>
                  </div>
                )}

                {isIOS && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="s-y7"
                    onClick={handleRestore}
                    disabled={purchaseState === 'processing' || purchaseState === 'verifying'}
                  >
                    {t('paymentSettings.restore')}
                  </Button>
                )}


                {!isIOS && (
                  <p className="s-vj s-u0 s-ul">
                    {t('paymentSettings.subsInAppShort')}
                  </p>
                )}

                <div className="s-sx s-o9 s-vj s-ul">
                  <p>
                    {t('paymentSettings.legalDisclosure')}
                  </p>
                  <div className="s-c5 s-cb s-dw s-dx s-o7">
                    <Link to="/terms" className="s-wy s-hv">
                      {t('paymentSettings.termsEula')}
                    </Link>
                    <Link to="/privacy" className="s-wy s-hv">
                      {t('paymentSettings.privacyPolicy')}
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default PaymentSettings;
