import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Languages, Globe, Bell, Flame, Trophy, Crown, Check, GraduationCap, FileText, HelpCircle, ExternalLink, Mail, Moon, Sun, Clock, Presentation, Mic, FileStack, AlertTriangle, BarChart3, Zap, Clock4, CreditCard, Receipt, XCircle, ChevronRight } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/contexts/ThemeContext";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

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
  // Removed selectedPlan and showStudentPricing - moved to PaymentSettings
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  
  // Practice hours state
  const [practiceStartHour, setPracticeStartHour] = useState(8);
  const [practiceEndHour, setPracticeEndHour] = useState(22);
  const [autoDetectTimezone, setAutoDetectTimezone] = useState(true);

  const isPremium = subscriptionTier === 'regular' || subscriptionTier === 'student' || subscriptionTier === 'enterprise';

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
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

        // Load practice hours and subscription from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("practice_start_hour, practice_end_hour, timezone, subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.practice_start_hour !== null) setPracticeStartHour(profile.practice_start_hour);
          if (profile.practice_end_hour !== null) setPracticeEndHour(profile.practice_end_hour);
          if (profile.subscription_tier) setSubscriptionTier(profile.subscription_tier);
        }

        // Auto-detect and update timezone if enabled
        if (autoDetectTimezone) {
          const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (!profile?.timezone || profile.timezone !== detectedTimezone) {
            await supabase
              .from("profiles")
              .update({ timezone: detectedTimezone })
              .eq("id", user.id);
          }
        }

        // Calculate streak (count both practice + full presentations)
        const { data: userSpeeches } = await supabase
          .from("speeches")
          .select("id")
          .eq("user_id", user.id);

        if (!userSpeeches || userSpeeches.length === 0) {
          setCurrentStreak(0);
          setBestStreak(0);
          return;
        }

        const userSpeechIds = userSpeeches.map((s) => s.id);

        const [practiceResult, presentationResult] = await Promise.all([
          supabase
            .from("practice_sessions")
            .select("session_date, speech_id")
            .in("speech_id", userSpeechIds)
            .order("session_date", { ascending: false }),
          supabase
            .from("presentation_sessions")
            .select("created_at, speech_id")
            .in("speech_id", userSpeechIds)
            .order("created_at", { ascending: false }),
        ]);

        const allSessions = [
          ...(practiceResult.data || []).map((s) => ({ date: s.session_date })),
          ...(presentationResult.data || []).map((s) => ({ date: s.created_at })),
        ];

        const DAY_MS = 1000 * 60 * 60 * 24;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const uniqueDays = new Set<number>();
        for (const s of allSessions) {
          if (!s.date) continue;
          const d = new Date(s.date);
          d.setHours(0, 0, 0, 0);
          uniqueDays.add(d.getTime());
        }

        const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

        // Current streak: count consecutive days ending today OR yesterday
        let streak = 0;
        if (sortedDays.length > 0) {
          const firstDiff = Math.floor((today.getTime() - sortedDays[0]) / DAY_MS);
          if (firstDiff === 0 || firstDiff === 1) {
            streak = 1;
            for (let i = 1; i < sortedDays.length; i++) {
              const gap = Math.floor((sortedDays[i - 1] - sortedDays[i]) / DAY_MS);
              if (gap === 1) streak++;
              else break;
            }
          }
        }

        setCurrentStreak(streak);

        // Best streak: longest consecutive-day run
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDay: number | null = null;

        for (const day of sortedDays) {
          if (prevDay === null) {
            tempStreak = 1;
          } else {
            const diff = Math.floor((prevDay - day) / DAY_MS);
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
  }, [i18n.language, autoDetectTimezone]);

  // Save practice hours
  const savePracticeHours = async (startHour: number, endHour: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          practice_start_hour: startHour,
          practice_end_hour: endHour
        })
        .eq("id", user.id);

      toast({
        title: t('common.success'),
        description: t('settings.practiceHours.saved'),
      });
    } catch (error) {
      console.error('Error saving practice hours:', error);
    }
  };

  const handleStartHourChange = (value: string) => {
    const hour = parseInt(value);
    setPracticeStartHour(hour);
    savePracticeHours(hour, practiceEndHour);
  };

  const handleEndHourChange = (value: string) => {
    const hour = parseInt(value);
    setPracticeEndHour(hour);
    savePracticeHours(practiceStartHour, hour);
  };

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };


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

          {/* Payment & Subscription - Navigates to dedicated page */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => navigate("/settings/payment")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                    <CreditCard className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle>{t('settings.payment.title')}</CardTitle>
                    <CardDescription>
                      {isPremium ? t('settings.payment.managePlan') : t('settings.payment.viewPlans')}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isPremium && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                      Premium
                    </span>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
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
                    <SelectValue>
                      {languages.find(l => l.code === currentLanguage)?.flag} {languages.find(l => l.code === currentLanguage)?.name}
                    </SelectValue>
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


          {/* Practice Hours */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.practiceHours.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.practiceHours.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.practiceHours.startTime')}</Label>
                  <Select value={practiceStartHour.toString()} onValueChange={handleStartHourChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 13 }, (_, i) => i + 5).map((hour) => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {formatHour(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.practiceHours.endTime')}</Label>
                  <Select value={practiceEndHour.toString()} onValueChange={handleEndHourChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 8 }, (_, i) => i + 17).map((hour) => (
                        <SelectItem key={hour} value={hour.toString()}>
                          {formatHour(hour)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4 space-y-2">
                <p className="text-sm font-medium">
                  {t('settings.practiceHours.preview', { 
                    start: formatHour(practiceStartHour), 
                    end: formatHour(practiceEndHour) 
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.practiceHours.sleepProtection')}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('settings.practiceHours.autoTimezone')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </p>
                </div>
                <Switch
                  checked={autoDetectTimezone}
                  onCheckedChange={setAutoDetectTimezone}
                />
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
                    <>
                      <Separator />
                      
                      {/* Notification Time Window */}
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <Clock4 className="h-4 w-4" />
                          {t('settings.notifications.notificationWindow')}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.notifications.notificationWindowDesc')}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">{t('settings.notifications.from')}</Label>
                            <Select value={practiceStartHour.toString()} onValueChange={handleStartHourChange}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                                  <SelectItem key={hour} value={hour.toString()}>
                                    {formatHour(hour)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('settings.notifications.to')}</Label>
                            <Select value={practiceEndHour.toString()} onValueChange={handleEndHourChange}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                                  <SelectItem key={hour} value={hour.toString()}>
                                    {formatHour(hour)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      
                      <div className="rounded-lg bg-primary/10 p-3 space-y-1">
                        <p className="text-sm font-medium">
                          ✓ {t('settings.notifications.enabled')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('settings.notifications.windowPreview', {
                            start: formatHour(practiceStartHour),
                            end: formatHour(practiceEndHour)
                          })}
                        </p>
                      </div>
                    </>
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
                <CardTitle>{t('settings.legal.termsTitle')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.legal.termsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/terms', '_blank')}
              >
                <span>{t('settings.legal.termsOfService')}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/privacy', '_blank')}
              >
                <span>{t('settings.legal.privacyPolicy')}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => window.open('/cookies', '_blank')}
              >
                <span>{t('settings.legal.cookiePolicy')}</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Contact Support/Help Center */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <CardTitle>{t('settings.support.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('settings.support.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open('/help', '_blank')}
                >
                  <span>{t('settings.support.helpCenter')}</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open('https://discord.gg/sermable', '_blank')}
                >
                  <span>{t('settings.support.joinCommunity')}</span>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.location.href = 'mailto:support@sermable.com'}
                >
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{t('settings.support.emailSupport')}</span>
                  </div>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">{t('settings.support.needHelp')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.support.needHelpDesc')}
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
