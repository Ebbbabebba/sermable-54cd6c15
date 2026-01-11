import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Languages, Globe, Bell, Flame, Trophy, Crown, Check, GraduationCap, FileText, HelpCircle, ExternalLink, Mail, Moon, Sun, Clock, Presentation, Mic, FileStack, AlertTriangle, BarChart3, Zap, Clock4 } from "lucide-react";
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
  
  // Practice hours state
  const [practiceStartHour, setPracticeStartHour] = useState(8);
  const [practiceEndHour, setPracticeEndHour] = useState(22);
  const [autoDetectTimezone, setAutoDetectTimezone] = useState(true);

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

        // Load practice hours from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("practice_start_hour, practice_end_hour, timezone")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.practice_start_hour !== null) setPracticeStartHour(profile.practice_start_hour);
          if (profile.practice_end_hour !== null) setPracticeEndHour(profile.practice_end_hour);
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

          {/* Subscription Section - Premium Upgrade */}
          <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 overflow-hidden relative">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
            
            <CardHeader className="relative pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
                    <Crown className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t('settings.subscription.title')}</CardTitle>
                    <CardDescription className="text-xs">
                      {t('settings.subscription.description')}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-5 relative">

              {/* Key benefits - compact grid */}
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
