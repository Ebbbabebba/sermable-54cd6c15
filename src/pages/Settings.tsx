import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Languages, Flame, Trophy, CreditCard, ChevronRight, Trash2, Volume2, VolumeX, Clock, Mail, ExternalLink, FileText } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { FORCE_PREMIUM, effectiveTier } from "@/lib/premiumOverride";
import { SupportContactDialog } from "@/components/SupportContactDialog";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

// iOS-style section wrapper
const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`s-m8 s-qo s-4b s-mn ${className}`}>
    {children}
  </div>
);

// iOS-style row
const Row = ({ children, onClick, last = false }: { children: React.ReactNode; onClick?: () => void; last?: boolean }) => (
  <div
    className={`s-c5 s-ib s-if s-os s-p6 s-l3 ${!last ? 's-6v s-6z s-ll s-nq' : ''} ${onClick ? 's-27 s-8m' : ''}`}
    onClick={onClick}
  >
    {children}
  </div>
);

// Section header label
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="s-ov s-of s-n2">
    <span className="s-vj s-d0 s-x1 s-wi s-ul">{children}</span>
  </div>
);

// Section footer hint
const SectionFooter = ({ children }: { children: React.ReactNode }) => (
  <div className="s-ov s-o8 s-n4">
    <span className="s-vj s-ul s-ir">{children}</span>
  </div>
);

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const { notificationsEnabled, registerPushNotifications } = usePushNotifications();
  const isNativePlatform = Capacitor.isNativePlatform();
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(FORCE_PREMIUM ? 'regular' : 'free');
  const [supportOpen, setSupportOpen] = useState(false);

  const [practiceStartHour, setPracticeStartHour] = useState(8);
  const [practiceEndHour, setPracticeEndHour] = useState(22);

  // Reminders are on by default — ask for permission silently on native.
  useEffect(() => {
    if (isNativePlatform && !notificationsEnabled) {
      registerPushNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNativePlatform, notificationsEnabled]);
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
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("practice_start_hour, practice_end_hour, timezone, subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (profile.practice_start_hour !== null) setPracticeStartHour(profile.practice_start_hour);
          if (profile.practice_end_hour !== null) setPracticeEndHour(profile.practice_end_hour);
          if (profile.subscription_tier) setSubscriptionTier(effectiveTier(profile.subscription_tier) as SubscriptionTier);
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      await supabase
        .from("profiles")
        .update({
          practice_start_hour: start,
          practice_end_hour: end,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    <div className="s-l6 s-5u">
      {/* iOS-style navigation bar */}
      <header className="s-t7 s-w1 s-ye s-3i s-5w s-6v s-6y" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="s-c5 s-ib s-fo s-os">
          <Button variant="ghost" size="sm" className="s-uw -ml-2 s-dl s-op" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="s-fz s-xt" />
            {t('common.back')}
          </Button>
          <h1 className="s-26 s-iu s-8 s-tn s-d3">{t('settings.title')}</h1>
        </div>
      </header>

      <div className="s-n3 s-mq" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 3rem)' }}>
        {/* Subscription — hidden while payments are disabled */}
        {!FORCE_PREMIUM && (
          <>
            <SectionLabel>{t('settings.payment.title')}</SectionLabel>
            <Section>
              <Row onClick={() => navigate("/settings/payment")} last>
                <div className="s-c5 s-ib s-dp">
                  <div className="s-xy s-g4 s-qi s-4s from-primary s-vz s-c5 s-ib s-ig">
                    <CreditCard className="s-fz s-xt s-ux" />
                  </div>
                  <div>
                    <span className="s-v9 s-d0">{isPremium ? t('settings.payment.managePlan') : t('settings.payment.viewPlans')}</span>
                  </div>
                </div>
                <div className="s-c5 s-ib s-dn">
                  <ChevronRight className="s-fz s-xt s-ul" />
                </div>
              </Row>
            </Section>
          </>
        )}

        {/* Appearance */}
        <SectionLabel>{t('settings.appearance.title')}</SectionLabel>
        <Section>
          <Row last>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-5a s-c5 s-ib s-ig">
                {soundEnabled ? <Volume2 className="s-fz s-xt s-uu" /> : <VolumeX className="s-fz s-xt s-uu" />}
              </div>
              <span className="s-v9">{t('settings.appearance.sounds', 'Sound effects')}</span>
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
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-4x s-c5 s-ib s-ig">
                <Languages className="s-fz s-xt s-ue" />
              </div>
              <span className="s-v9">{t('settings.language.appLanguage')}</span>
            </div>
            <Select value={currentLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="s-y6 s-ld s-g6 s-6m s-61 s-v9 s-ul s-ih s-dl">
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
          <div className="s-e0 s-e2 divide-x s-bm">
            <div className="s-mw s-u0">
              <div className="s-c5 s-ib s-ig s-dm s-ul s-jw">
                <Flame className="s-fx s-xq" />
                <span className="s-vj">{t('settings.profile.currentStreak')}</span>
              </div>
              <div className="s-t9 s-cx">{currentStreak}</div>
              <div className="s-tl s-ul">{t('settings.profile.days')}</div>
            </div>
            <div className="s-mw s-u0">
              <div className="s-c5 s-ib s-ig s-dm s-ul s-jw">
                <Trophy className="s-fx s-xq" />
                <span className="s-vj">{t('settings.profile.bestStreak')}</span>
              </div>
              <div className="s-t9 s-cx">{bestStreak}</div>
              <div className="s-tl s-ul">{t('settings.profile.days')}</div>
            </div>
          </div>
        </Section>
        <SectionFooter>{t('settings.profile.keepStreakDesc')}</SectionFooter>

        {/* Practice Hours */}
        <SectionLabel>{t('settings.practiceHours.title')}</SectionLabel>
        <Section>
          <Row>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-59 s-c5 s-ib s-ig">
                <Clock className="s-fz s-xt s-us" />
              </div>
              <span className="s-v9">{t('settings.practiceHours.startTime')}</span>
            </div>
            <Select value={practiceStartHour.toString()} onValueChange={handleStartHourChange}>
              <SelectTrigger className="s-y6 s-lf s-g6 s-6m s-61 s-v9 s-ul s-ih s-dl">
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
          <Row last>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-59 s-c5 s-ib s-ig">
                <Clock className="s-fz s-xt s-us" />
              </div>
              <span className="s-v9">{t('settings.practiceHours.endTime')}</span>
            </div>
            <Select value={practiceEndHour.toString()} onValueChange={handleEndHourChange}>
              <SelectTrigger className="s-y6 s-lf s-g6 s-6m s-61 s-v9 s-ul s-ih s-dl">
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
        </Section>
        <SectionFooter>{t('settings.practiceHours.sleepProtection')}</SectionFooter>


        {/* Support */}
        <SectionLabel>{t('settings.support.title')}</SectionLabel>
        <Section>
          <Row onClick={() => setSupportOpen(true)} last>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-48 s-c5 s-ib s-ig">
                <Mail className="s-fz s-xt s-ty" />
              </div>
              <span className="s-v9">{t('settings.support.emailSupport')}</span>
            </div>
            <ExternalLink className="s-fz s-xt s-ul" />
          </Row>
        </Section>

        {/* Legal */}
        <SectionLabel>{t('settings.legal.termsTitle')}</SectionLabel>
        <Section>
          <Row onClick={() => window.open('/terms', '_blank')}>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-4u s-c5 s-ib s-ig">
                <FileText className="s-fz s-xt s-uc" />
              </div>
              <span className="s-v9">{t('settings.legal.termsOfService')}</span>
            </div>
            <ExternalLink className="s-fz s-xt s-ul" />
          </Row>
          <Row onClick={() => window.open('/privacy', '_blank')}>
            <span className="s-v9 s-lj">{t('settings.legal.privacyPolicy')}</span>
            <ExternalLink className="s-fz s-xt s-ul" />
          </Row>
          <Row onClick={() => window.open('/refund-policy', '_blank')} last>
            <span className="s-v9 s-lj">{t('settings.legal.refundPolicy')}</span>
            <ExternalLink className="s-fz s-xt s-ul" />
          </Row>
        </Section>

        {/* Account */}
        <SectionLabel>{t('settings.account.title')}</SectionLabel>
        <Section className="s-k2">
          <Row onClick={() => navigate('/settings/account')} last>
            <div className="s-c5 s-ib s-dp">
              <div className="s-xy s-g4 s-qi s-5p s-c5 s-ib s-ig">
                <Trash2 className="s-fz s-xt s-v1" />
              </div>
              <span className="s-v9">{t('settings.account.manageAccount')}</span>
            </div>
            <ChevronRight className="s-fz s-xt s-ul" />
          </Row>
        </Section>
      </div>

      <SupportContactDialog open={supportOpen} onOpenChange={setSupportOpen} />
    </div>
  );
};

export default Settings;
