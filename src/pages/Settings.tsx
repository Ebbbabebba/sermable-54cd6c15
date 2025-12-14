import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Languages, Globe, Bell, Flame, Trophy, Crown, Check, GraduationCap, FileText, HelpCircle, ExternalLink, Mail, Moon, Sun } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const { notificationsEnabled, registerPushNotifications } = usePushNotifications();
  const isNativePlatform = Capacitor.isNativePlatform();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showStudentPricing, setShowStudentPricing] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
  ];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setCurrentLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
  };

  useEffect(() => {
    // Sync with current language on mount
    setCurrentLanguage(i18n.language);
    
    // Load user data
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;


        // Calculate streak
        const { data: sessions } = await supabase
          .from("practice_sessions")
          .select("session_date, speech_id")
          .order("session_date", { ascending: false });

        const { data: userSpeeches } = await supabase
          .from("speeches")
          .select("id")
          .eq("user_id", user.id);

        if (!userSpeeches || !sessions) return;

        const userSpeechIds = new Set(userSpeeches.map(s => s.id));
        const userSessions = sessions.filter(s => userSpeechIds.has(s.speech_id));

        // Calculate current streak
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const uniqueDays = new Set(
          userSessions.map(s => {
            const date = new Date(s.session_date);
            date.setHours(0, 0, 0, 0);
            return date.getTime();
          })
        );

        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

        let streak = 0;
        for (let i = 0; i < sortedDays.length; i++) {
          const daysDiff = Math.floor((today.getTime() - sortedDays[i]) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === i) {
            streak++;
          } else {
            break;
          }
        }

        setCurrentStreak(streak);

        // Calculate best streak
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDay = null;

        for (const day of sortedDays) {
          if (prevDay === null) {
            tempStreak = 1;
          } else {
            const diff = Math.floor((prevDay - day) / (1000 * 60 * 60 * 24));
            if (diff === 1) {
              tempStreak++;
            } else {
              maxStreak = Math.max(maxStreak, tempStreak);
              tempStreak = 1;
            }
          }
          prevDay = day;
        }
        maxStreak = Math.max(maxStreak, tempStreak);
        setBestStreak(maxStreak);

      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [i18n.language]);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">{t('settings.title')}</h1>
            <p className="text-muted-foreground">
              {t('settings.subtitle')}
            </p>
          </div>

          {/* Subscription Section */}
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.subscription.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.subscription.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Premium Features */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{t('settings.subscription.whyPremium')}</h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('settings.subscription.overrideLock')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.subscription.overrideLockDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('settings.subscription.unlimitedSpeeches')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.subscription.unlimitedSpeechesDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('settings.subscription.advancedAnalytics')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.subscription.advancedAnalyticsDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('settings.subscription.streakFreeze')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.subscription.streakFreezeDesc')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{t('settings.subscription.prioritySupport')}</p>
                      <p className="text-sm text-muted-foreground">{t('settings.subscription.prioritySupportDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pricing Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">{t('settings.subscription.choosePlan')}</h3>
                
                {showStudentPricing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">{t('settings.subscription.studentPricing')}</p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{t('settings.subscription.studentMonthly')}</p>
                          <p className="text-sm text-muted-foreground">{t('settings.subscription.billedMonthly')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€3.90</p>
                          <p className="text-xs text-muted-foreground line-through">€7.90</p>
                          <p className="text-xs text-primary">{t('settings.subscription.studentDiscount')}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('annual')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{t('settings.subscription.studentAnnual')}</p>
                          <p className="text-sm text-muted-foreground">{t('settings.subscription.billedYearly')} • {t('settings.subscription.save')} 33%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€39.90</p>
                          <p className="text-xs text-muted-foreground line-through">€79.90</p>
                          <p className="text-xs text-primary">{t('settings.subscription.studentDiscount')}</p>
                        </div>
                      </div>
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowStudentPricing(false)}
                      className="w-full"
                    >
                      {t('settings.subscription.backToRegular')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{t('settings.subscription.monthly')}</p>
                          <p className="text-sm text-muted-foreground">{t('settings.subscription.billedMonthly')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€7.90</p>
                          <p className="text-xs text-muted-foreground">{t('settings.subscription.perMonth')}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('annual')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md font-medium">
                        {t('settings.subscription.save')} 33%
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">{t('settings.subscription.annual')}</p>
                          <p className="text-sm text-muted-foreground">{t('settings.subscription.billedYearly')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€79.90</p>
                          <p className="text-xs text-muted-foreground">€6.66/{t('settings.subscription.perMonth').split(' ')[0]}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Student Button */}
              {!showStudentPricing && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowStudentPricing(true)}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  {t('settings.subscription.studentButton')}
                </Button>
              )}

              {/* Continue Button */}
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedPlan}
                onClick={() => {
                  toast({
                    title: t('settings.subscription.comingSoon'),
                    description: t('settings.subscription.comingSoonDesc'),
                  });
                }}
              >
                {t('settings.subscription.continueWith')} {selectedPlan === 'monthly' ? t('settings.subscription.monthly') : selectedPlan === 'annual' ? t('settings.subscription.annual') : ''} 
              </Button>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                <CardTitle>{t('settings.appearance.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.appearance.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="theme-toggle">{t('settings.appearance.theme')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {theme === 'dark' ? t('settings.appearance.darkTheme') : t('settings.appearance.lightTheme')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Switch
                    id="theme-toggle"
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.language.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.language.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label htmlFor="app-language">{t('settings.language.appLanguage')}</Label>
                <Select
                  value={currentLanguage}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger id="app-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('settings.language.hint')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Profile & Streak */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.profile.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.profile.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Flame className="h-4 w-4" />
                    <span className="text-sm">{t('settings.profile.currentStreak')}</span>
                  </div>
                  <div className="text-3xl font-bold">{currentStreak}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.profile.days')}</div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">{t('settings.profile.bestStreak')}</span>
                  </div>
                  <div className="text-3xl font-bold">{bestStreak}</div>
                  <div className="text-xs text-muted-foreground">{t('settings.profile.days')}</div>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4 space-y-2">
                <p className="text-sm font-medium">{t('settings.profile.keepStreak')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.profile.keepStreakDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.account.title')}</CardTitle>
              <CardDescription>
                {t('settings.account.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">{t('settings.account.personalizedLearning')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.account.personalizedLearningDesc')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.notifications.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.notifications.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isNativePlatform ? (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">{t('settings.notifications.nativeRequired')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.notifications.nativeRequiredDesc')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.notifications.pushNotifications')}</Label>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.notifications.pushNotificationsDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={notificationsEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          registerPushNotifications();
                        }
                      }}
                    />
                  </div>
                  
                  {notificationsEnabled && (
                    <div className="rounded-lg bg-primary/10 p-3">
                      <p className="text-xs text-muted-foreground">
                        ✓ {t('settings.notifications.enabled')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Terms and Conditions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <CardTitle>Terms and Conditions</CardTitle>
              </div>
              <CardDescription>
                Review our policies and legal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/terms', '_blank')}
              >
                <span>Terms of Service</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/privacy', '_blank')}
              >
                <span>Privacy Policy</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/cookies', '_blank')}
              >
                <span>Cookie Policy</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Contact Support/Help Center */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle>Contact Support</CardTitle>
              </div>
              <CardDescription>
                Get help and access our support resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open('/help', '_blank')}
                >
                  <span>Help Center</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open('https://discord.gg/sermable', '_blank')}
                >
                  <span>Join Community</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.location.href = 'mailto:support@sermable.com'}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Email Support</span>
                  </div>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Need Help?</p>
                <p className="text-xs text-muted-foreground">
                  Our support team typically responds within 24 hours. For urgent issues, please email us directly at support@sermable.com
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
