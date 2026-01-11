import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Crown, CreditCard, Receipt, Check, GraduationCap, Zap, FileStack, Presentation, BarChart3, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

const PaymentSettings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showStudentPricing, setShowStudentPricing] = useState(false);
  const [showCancelSection, setShowCancelSection] = useState(false);

  const isPremium = subscriptionTier === 'regular' || subscriptionTier === 'student' || subscriptionTier === 'enterprise';

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{t('settings.payment.title')}</h1>
            <p className="text-muted-foreground">
              {t('settings.payment.subtitle')}
            </p>
          </div>

          {isPremium ? (
            <>
              {/* Premium Status */}
              <Card className="border-0 bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                      <Crown className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.subscription.youArePremium')}</CardTitle>
                      <CardDescription>{t('settings.subscription.premiumDesc')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" />
                    <CardTitle>{t('settings.subscription.paymentHistory')}</CardTitle>
                  </div>
                  <CardDescription>
                    {t('settings.payment.viewPayments')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-card border p-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('settings.subscription.lastPayment')}</span>
                      <span className="font-medium">€7.90 - 11 jan 2026</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('settings.subscription.nextPayment')}</span>
                      <span className="font-medium">€7.90 - 11 feb 2026</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      toast({
                        title: t('settings.subscription.comingSoon'),
                        description: t('settings.subscription.viewAllPaymentsDesc'),
                      });
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {t('settings.subscription.viewAllPayments')}
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <CardTitle>{t('settings.payment.paymentMethod')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                        <span className="text-white text-xs font-bold">VISA</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                        <p className="text-xs text-muted-foreground">{t('settings.payment.expires')} 12/27</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: t('settings.subscription.comingSoon'),
                          description: t('settings.payment.updateCardDesc'),
                        });
                      }}
                    >
                      {t('settings.payment.update')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Hidden Cancel Section - requires extra click */}
              <Collapsible open={showCancelSection} onOpenChange={setShowCancelSection}>
                <Card className="border-muted">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          <CardTitle className="text-base font-normal text-muted-foreground">
                            {t('settings.payment.moreOptions')}
                          </CardTitle>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showCancelSection ? 'rotate-180' : ''}`} />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {t('settings.payment.cancelInfo')}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            toast({
                              title: t('settings.subscription.comingSoon'),
                              description: t('settings.subscription.cancelDesc'),
                            });
                          }}
                        >
                          {t('settings.subscription.cancelSubscription')}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.subscription.cancelNote')}
                        </p>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </>
          ) : (
            /* Free User View - Upgrade Options */
            <>
              <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
                
                <CardHeader className="relative pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                      <Crown className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{t('settings.subscription.upgradeToPremium')}</CardTitle>
                      <CardDescription className="text-xs">
                        {t('settings.subscription.description')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-5 relative">
                  {/* Key benefits */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                      <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                        <FileStack className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('settings.subscription.unlimitedSpeeches')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.subscription.noLimits')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                      <div className="p-1.5 rounded-lg bg-accent/20 shrink-0">
                        <Presentation className="h-4 w-4 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('settings.subscription.presentationMode')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.subscription.fullRunthrough')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                      <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
                        <Zap className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('settings.subscription.overrideLock')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.subscription.practiceAnytime')}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-card/80 border">
                      <div className="p-1.5 rounded-lg bg-accent/20 shrink-0">
                        <BarChart3 className="h-4 w-4 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{t('settings.subscription.advancedAnalytics')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.subscription.deepInsights')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Cards */}
                  <div className="space-y-3 pt-2">
                    {showStudentPricing ? (
                      <>
                        <div className="flex items-center justify-center gap-2 mb-3">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-primary">{t('settings.subscription.studentPricing')}</p>
                        </div>
                        
                        <button
                          onClick={() => setSelectedPlan('annual')}
                          className={`w-full p-4 rounded-2xl transition-all text-left relative overflow-hidden ${
                            selectedPlan === 'annual'
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                              : 'bg-card border-2 border-border hover:border-primary/50'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium ${
                            selectedPlan === 'annual' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
                          }`}>
                            {t('settings.subscription.bestValue')}
                          </div>
                          <div>
                            <p className="text-sm font-medium opacity-80">{t('settings.subscription.studentAnnual')}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-3xl font-bold">€3.33</p>
                              <p className="text-sm opacity-70">/{t('settings.subscription.month')}</p>
                            </div>
                            <p className="text-xs opacity-60 mt-1">€39.90 {t('settings.subscription.billedYearly')}</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setSelectedPlan('monthly')}
                          className={`w-full p-4 rounded-2xl transition-all text-left ${
                            selectedPlan === 'monthly'
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                              : 'bg-card border-2 border-border hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium opacity-80">{t('settings.subscription.studentMonthly')}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-3xl font-bold">€3.90</p>
                              <p className="text-sm opacity-70">/{t('settings.subscription.month')}</p>
                            </div>
                          </div>
                        </button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowStudentPricing(false)}
                          className="w-full text-muted-foreground"
                        >
                          {t('settings.subscription.backToRegular')}
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setSelectedPlan('annual')}
                          className={`w-full p-4 rounded-2xl transition-all text-left relative overflow-hidden ${
                            selectedPlan === 'annual'
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                              : 'bg-card border-2 border-border hover:border-primary/50'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium ${
                            selectedPlan === 'annual' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary text-primary-foreground'
                          }`}>
                            {t('settings.subscription.mostPopular')}
                          </div>
                          <div>
                            <p className="text-sm font-medium opacity-80">{t('settings.subscription.annual')}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-3xl font-bold">€6.66</p>
                              <p className="text-sm opacity-70">/{t('settings.subscription.month')}</p>
                            </div>
                            <p className="text-xs opacity-60 mt-1">€79.90 {t('settings.subscription.billedYearly')} · {t('settings.subscription.save')} 33%</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setSelectedPlan('monthly')}
                          className={`w-full p-4 rounded-2xl transition-all text-left ${
                            selectedPlan === 'monthly'
                              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                              : 'bg-card border-2 border-border hover:border-primary/50'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium opacity-80">{t('settings.subscription.monthly')}</p>
                            <div className="flex items-baseline gap-2 mt-1">
                              <p className="text-3xl font-bold">€7.90</p>
                              <p className="text-sm opacity-70">/{t('settings.subscription.month')}</p>
                            </div>
                          </div>
                        </button>
                      </>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20"
                    size="lg"
                    disabled={!selectedPlan}
                    onClick={() => {
                      toast({
                        title: t('settings.subscription.comingSoon'),
                        description: t('settings.subscription.comingSoonDesc'),
                      });
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {t('settings.subscription.upgradeCta')}
                  </Button>

                  {/* Student link */}
                  {!showStudentPricing && (
                    <button
                      onClick={() => setShowStudentPricing(true)}
                      className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      {t('settings.subscription.studentButton')}
                    </button>
                  )}

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('settings.subscription.cancelAnytime')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('settings.subscription.securePayment')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default PaymentSettings;
