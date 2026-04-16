import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Languages, Bell, Flame, Trophy, CreditCard, ChevronRight, Trash2, Volume2, VolumeX, Moon, Sun, Clock, MessageCircle, Mail, ExternalLink, FileText, Clock4 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

// iOS-style section wrapper
const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-4 rounded-xl bg-card overflow-hidden ${className}`}>
    {children}
  </div>
);

// iOS-style row
const Row = ({ children, onClick, last = false }: { children: React.ReactNode; onClick?: () => void; last?: boolean }) => (
  <div
    className={`flex items-center justify-between px-4 py-3 min-h-[44px] ${!last ? 'border-b border-border/40 ml-4 pl-0' : ''} ${onClick ? 'active:bg-muted/60 cursor-pointer' : ''}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// Section header label
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-8 pt-6 pb-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</span>
  </div>
);

// Section footer hint
const SectionFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="px-8 pt-1.5 pb-2">
    <span className="text-xs text-muted-foreground leading-tight">{children}</span>
  </div>
);

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
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('free');
  
  const [practiceStartHour, setPracticeStartHour] = useState(8);
  const [practiceEndHour, setPracticeEndHour] = useState(22);
  const [autoDetectTimezone, setAutoDetectTimezone] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('soundEnabled');
    return stored !== 'false';
  });

  const isPremium = subscriptionTier === 'regular' || subscriptionTier === 'student' || subscriptionTier === 'enterprise';

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'sv', name: 'Svenska' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
  ];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setCurrentLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
  };

  useEffect(() => {
    setCurrentLanguage(i18n.language);
    
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

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

        // Calculate streaks
        const { data: userSpeeches } = await supabase
          .from("speeches")
          .select("id")
          .eq("user_id", user.id);

        if (userSpeeches && userSpeeches.length > 0) {
          const userSpeechIds = userSpeeches.map(s => s.id);

          const [practiceResult, presentationResult] = await Promise.all([
            supabase
              .from("practice_sessions")
              .select("session_date")
              .in("speech_id", userSpeechIds)
              .order("session_date", { ascending: false }),
            supabase
              .from("presentation_sessions")
              .select("created_at")
              .in("speech_id", userSpeechIds)
              .order("created_at", { ascending: false })
          ]);

          const allDates = [
            ...(practiceResult.data || []).map(s => s.session_date),
            ...(presentationResult.data || []).map(s => s.created_at)
          ];

          const uniqueDays = new Set<number>();
          allDates.forEach(d => {
            const date = new Date(d);
            date.setHours(0, 0, 0, 0);
            uniqueDays.add(date.getTime());
          });

          const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);

          if (sortedDays.length > 0) {
            let streak = 0;
            const mostRecent = sortedDays[0];
            for (let i = 0; i < sortedDays.length; i++) {
              const expected = new Date(mostRecent);
              expected.setDate(expected.getDate() - i);
              if (sortedDays.includes(expected.getTime())) {
                streak++;
              } else break;
            }
            setCurrentStreak(streak);

            let best = 0;
            let tempStreak = 1;
            for (let i = 1; i < sortedDays.length; i++) {
              const diff = sortedDays[i - 1] - sortedDays[i];
              if (diff === 86400000) {
                tempStreak++;
              } else {
                best = Math.max(best, tempStreak);
                tempStreak = 1;
              }
            }
            best = Math.max(best, tempStreak);
            setBestStreak(best);
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [i18n.language]);

  const savePracticeHours = async (start: number, end: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          practice_start_hour: start,
          practice_end_hour: end,
          timezone: autoDetectTimezone ? Intl.DateTimeFormat().resolvedOptions().timeZone : null,
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
    <div className="min-h-screen bg-secondary/30">
      {/* iOS-style navigation bar */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-secondary/60 border-b border-border/30" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center h-11 px-4">
          <Button variant="ghost" size="sm" className="text-primary -ml-2 gap-1 px-2" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">{t('settings.title')}</h1>
        </div>
      </header>

      <div className="pb-12 overflow-y-auto" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 3rem)' }}>
        {/* Subscription */}
        <SectionLabel>{t('settings.payment.title')}</SectionLabel>
        <Section>
          <Row onClick={() => navigate("/settings/payment")} last>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <span className="text-sm font-medium">{isPremium ? t('settings.payment.managePlan') : t('settings.payment.viewPlans')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isPremium && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                  Premium
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Row>
        </Section>

        {/* Appearance */}
        <SectionLabel>{t('settings.appearance.title')}</SectionLabel>
        <Section>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-indigo-500/15 flex items-center justify-center">
                {theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-500" /> : <Sun className="h-4 w-4 text-indigo-500" />}
              </div>
              <span className="text-sm">{t('settings.appearance.theme')}</span>
            </div>
            <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
          </Row>
          <Row last>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-pink-500/15 flex items-center justify-center">
                {soundEnabled ? <Volume2 className="h-4 w-4 text-pink-500" /> : <VolumeX className="h-4 w-4 text-pink-500" />}
              </div>
              <span className="text-sm">{t('settings.appearance.sounds', 'Sound effects')}</span>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={(checked) => {
                setSoundEnabled(checked);
                localStorage.setItem('soundEnabled', String(checked));
              }}
            />
          </Row>
        </Section>

        {/* Language */}
        <SectionLabel>{t('settings.language.title')}</SectionLabel>
        <Section>
          <Row last>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-green-500/15 flex items-center justify-center">
                <Languages className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-sm">{t('settings.language.appLanguage')}</span>
            </div>
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-auto min-w-[120px] h-8 border-0 bg-transparent text-sm text-muted-foreground justify-end gap-1">
                <SelectValue>
                  {languages.find(l => l.code === currentLanguage)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </Section>
        <SectionFooter>{t('settings.language.hint')}</SectionFooter>

        {/* Streak / Profile */}
        <SectionLabel>{t('settings.profile.title')}</SectionLabel>
        <Section>
          <div className="grid grid-cols-2 divide-x divide-border/40">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Flame className="h-3.5 w-3.5" />
                <span className="text-xs">{t('settings.profile.currentStreak')}</span>
              </div>
              <div className="text-2xl font-bold">{currentStreak}</div>
              <div className="text-[10px] text-muted-foreground">{t('settings.profile.days')}</div>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                <Trophy className="h-3.5 w-3.5" />
                <span className="text-xs">{t('settings.profile.bestStreak')}</span>
              </div>
              <div className="text-2xl font-bold">{bestStreak}</div>
              <div className="text-[10px] text-muted-foreground">{t('settings.profile.days')}</div>
            </div>
          </div>
        </Section>
        <SectionFooter>{t('settings.profile.keepStreakDesc')}</SectionFooter>

        {/* Practice Hours */}
        <SectionLabel>{t('settings.practiceHours.title')}</SectionLabel>
        <Section>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-orange-500/15 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm">{t('settings.practiceHours.startTime')}</span>
            </div>
            <Select value={practiceStartHour.toString()} onValueChange={handleStartHourChange}>
              <SelectTrigger className="w-auto min-w-[80px] h-8 border-0 bg-transparent text-sm text-muted-foreground justify-end gap-1">
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
          </Row>
          <Row>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-orange-500/15 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm">{t('settings.practiceHours.endTime')}</span>
            </div>
            <Select value={practiceEndHour.toString()} onValueChange={handleEndHourChange}>
              <SelectTrigger className="w-auto min-w-[80px] h-8 border-0 bg-transparent text-sm text-muted-foreground justify-end gap-1">
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
          </Row>
          <Row last>
            <div className="flex items-center gap-3">
              <span className="text-sm">{t('settings.practiceHours.autoTimezone')}</span>
            </div>
            <Switch checked={autoDetectTimezone} onCheckedChange={setAutoDetectTimezone} />
          </Row>
        </Section>
        <SectionFooter>{t('settings.practiceHours.sleepProtection')}</SectionFooter>

        {/* Notifications */}
        <SectionLabel>{t('settings.notifications.title')}</SectionLabel>
        <Section>
          {!isNativePlatform ? (
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground">{t('settings.notifications.nativeRequired')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('settings.notifications.nativeRequiredDesc')}</p>
            </div>
          ) : (
            <>
              <Row last={!notificationsEnabled}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-red-500/15 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-red-500" />
                  </div>
                  <span className="text-sm">{t('settings.notifications.pushNotifications')}</span>
                </div>
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={(checked) => {
                    if (checked) registerPushNotifications();
                  }}
                />
              </Row>
              {notificationsEnabled && (
                <>
                  <Row>
                    <span className="text-sm">{t('settings.notifications.from')}</span>
                    <Select value={practiceStartHour.toString()} onValueChange={handleStartHourChange}>
                      <SelectTrigger className="w-auto min-w-[80px] h-8 border-0 bg-transparent text-sm text-muted-foreground justify-end gap-1">
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
                  </Row>
                  <Row last>
                    <span className="text-sm">{t('settings.notifications.to')}</span>
                    <Select value={practiceEndHour.toString()} onValueChange={handleEndHourChange}>
                      <SelectTrigger className="w-auto min-w-[80px] h-8 border-0 bg-transparent text-sm text-muted-foreground justify-end gap-1">
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
                  </Row>
                </>
              )}
            </>
          )}
        </Section>

        {/* Support */}
        <SectionLabel>{t('settings.support.title')}</SectionLabel>
        <Section>
          <Row onClick={() => window.location.href = 'mailto:support@sermable.com'} last>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-blue-500/15 flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm">{t('settings.support.emailSupport')}</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Row>
        </Section>

        {/* Legal */}
        <SectionLabel>{t('settings.legal.termsTitle')}</SectionLabel>
        <Section>
          <Row onClick={() => window.open('/terms', '_blank')}>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-gray-500/15 flex items-center justify-center">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm">{t('settings.legal.termsOfService')}</span>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Row>
          <Row onClick={() => window.open('/privacy', '_blank')}>
            <span className="text-sm ml-10">{t('settings.legal.privacyPolicy')}</span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Row>
          <Row onClick={() => window.open('/refund-policy', '_blank')} last>
            <span className="text-sm ml-10">Refund Policy</span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Row>
        </Section>

        {/* Account */}
        <SectionLabel>{t('settings.account.title')}</SectionLabel>
        <Section className="mb-8">
          <Row onClick={() => navigate('/settings/account')} last>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-red-500/15 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-500" />
              </div>
              <span className="text-sm">{t('settings.account.manageAccount')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Row>
        </Section>
      </div>
    </div>
  );
};

export default Settings;
