import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Crown, Check, Zap, FileStack, Presentation, BarChart3, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isIOSNativeApp, triggerNativeIAP, getNativePrices } from "@/lib/iosBridge";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

const PaymentSettings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const isIOS = isIOSNativeApp();
  const [prices, setPrices] = useState<{ monthly?: string; yearly?: string }>(getNativePrices());

  const isPremium = subscriptionTier !== 'free';

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
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

  const handleUpgrade = () => {
    if (isIOS) {
      triggerNativeIAP(selectedPlan === 'yearly' ? 'buyYearly' : 'buyMonthly');
      return;
    }

    toast({
      title: "Upgrade in the iOS app",
      description: "Premium subscriptions are available through the Sermable iOS app on the App Store.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">Sermable Premium</h1>
            <p className="text-muted-foreground">
              Unlock the full Sermable experience.
            </p>
          </div>

          {isPremium ? (
            <Card className="border-0 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle>You are Premium</CardTitle>
                    <CardDescription>
                      Manage or cancel your subscription in your Apple ID settings.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    window.open('https://apps.apple.com/account/subscriptions', '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage subscription in App Store
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />

              <CardHeader className="relative pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                    <Crown className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Upgrade to Premium</CardTitle>
                    <CardDescription className="text-xs">
                      Everything you need to memorize any speech.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 relative">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                    <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                      <FileStack className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Unlimited speeches</p>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                    <div className="p-1.5 rounded-lg bg-accent/20 shrink-0">
                      <Presentation className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <p className="text-sm font-medium">Presentation mode</p>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                    <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Practice anytime</p>
                  </div>
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                    <div className="p-1.5 rounded-lg bg-accent/20 shrink-0">
                      <BarChart3 className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <p className="text-sm font-medium">Advanced analytics</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => setSelectedPlan('yearly')}
                    className={`w-full p-4 rounded-2xl transition-all text-left relative overflow-hidden ${
                      selectedPlan === 'yearly'
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'bg-card border-2 border-border hover:border-primary/50'
                    }`}
                  >
                    <div className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedPlan === 'yearly' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
                    }`}>
                      Best value
                    </div>
                    <p className="text-sm font-medium opacity-80">Yearly</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-3xl font-bold">{prices.yearly ?? '299 kr'}</p>
                      <p className="text-sm opacity-70">/year</p>
                    </div>
                    {!prices.yearly && (
                      <p className="text-xs opacity-60 mt-1">≈ 25 kr/month</p>
                    )}
                  </button>

                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`w-full p-4 rounded-2xl transition-all text-left ${
                      selectedPlan === 'monthly'
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'bg-card border-2 border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="text-sm font-medium opacity-80">Monthly</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <p className="text-3xl font-bold">{prices.monthly ?? '79 kr'}</p>
                      <p className="text-sm opacity-70">/month</p>
                    </div>
                  </button>
                </div>

                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  onClick={handleUpgrade}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  {isIOS ? 'Subscribe' : 'Get Premium'}
                </Button>

                {!isIOS && (
                  <p className="text-xs text-center text-muted-foreground">
                    Premium subscriptions are available in the Sermable iOS app on the App Store.
                  </p>
                )}

                <div className="space-y-1.5 pt-2 text-xs text-muted-foreground">
                  <p>
                    Payment will be charged to your Apple ID account at confirmation of purchase.
                    Subscription automatically renews unless auto-renew is turned off at least 24 hours
                    before the end of the current period. Manage or cancel anytime in your Apple ID
                    account settings.
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                    <Link to="/terms" className="underline hover:text-foreground">
                      Terms of Use (EULA)
                    </Link>
                    <Link to="/privacy" className="underline hover:text-foreground">
                      Privacy Policy
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
