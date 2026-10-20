import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, LogOut, Settings, Menu, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const UploadSpeechDialog = lazy(() => import("@/components/UploadSpeechDialog"));
import SpeechCard from "@/components/SpeechCard";
import ReviewNotifications from "@/components/ReviewNotifications";
import StreakCelebration from "@/components/StreakCelebration";
import { FORCE_PREMIUM, effectiveTier } from "@/lib/premiumOverride";
import { waitForStableSession } from "@/lib/authSession";
import { StatsCards, TodayTasks, todayTasks, SpeechesGlance, SpeechProgress } from '@/components/home/HomeOverview';
import { dateFormatter } from '@/lib/dateFormat';
import { BottomNav, type HomeTab } from '@/components/home/BottomNav';
import { SpeechMascot } from '@/components/home/SpeechMascot';
import { useSpeechOverview } from '@/hooks/useSpeechOverview';

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>(FORCE_PREMIUM ? 'regular' : 'free');
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sortBy, setSortBy] = useState<'deadline' | 'created' | 'updated'>('deadline');
  const [expiredQueue, setExpiredQueue] = useState<Speech[]>([]);
  const [deletingExpired, setDeletingExpired] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<HomeTab>('home');
  const overview = useSpeechOverview(speeches.map(s => s.id));
  const todayKey = new Date().toLocaleDateString('sv-SE');
  const nextSpeech = [...speeches].filter(s => !s.goal_date || s.goal_date >= todayKey).sort((a, b) => (a.goal_date || '9999').localeCompare(b.goal_date || '9999'))[0] ?? speeches[0];
  const nextBeats = overview.beats.filter(b => b.speech_id === nextSpeech?.id);
  const nextScore = overview.sessions.find(s => s.speech_id === nextSpeech?.id && s.score !== null)?.score ?? null;

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const session = await waitForStableSession();
      if (cancelled) return;

      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      setUser(session.user);
      loadSpeeches();
      checkStreak();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Only navigate away on explicit sign-out — transient null sessions
      // from token refreshes or network glitches should not kick the user out.
      if (event === "SIGNED_OUT") {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Re-check the streak whenever the app returns to the foreground on a new day.
  // In the native app the WebView is kept alive, so the mount effect alone is not enough.
  useEffect(() => {
    const maybeRecheckStreak = () => {
      if (document.visibilityState !== "visible") return;
      const lastShownDate = localStorage.getItem('streak-last-shown-date');
      const today = new Date().toDateString();
      if (lastShownDate !== today) {
        checkStreak();
      }
    };

    document.addEventListener("visibilitychange", maybeRecheckStreak);
    window.addEventListener("focus", maybeRecheckStreak);
    return () => {
      document.removeEventListener("visibilitychange", maybeRecheckStreak);
      window.removeEventListener("focus", maybeRecheckStreak);
    };
  }, []);

  // Local ledger of days the user opened the app (kept 60 days).
  const APP_OPEN_DAYS_KEY = 'streak-app-open-days';

  const getAppOpenDays = (): number[] => {
    try {
      const raw = localStorage.getItem(APP_OPEN_DAYS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((n): n is number => typeof n === 'number');
    } catch {
      return [];
    }
  };

  // Server-side ledger so the streak survives reinstalls and follows the account.
  const recordServerActivityDay = async (userId: string) => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await supabase
      .from('user_activity_days')
      .upsert({ user_id: userId, day }, { onConflict: 'user_id,day', ignoreDuplicates: true });
  };

  const getServerActivityDays = async (userId: string): Promise<number[]> => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const { data } = await supabase
      .from('user_activity_days')
      .select('day')
      .eq('user_id', userId)
      .gte('day', cutoffStr);
    return (data || []).map(row => {
      const [y, m, dd] = (row.day as string).split('-').map(Number);
      const date = new Date(y, m - 1, dd);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });
  };

  const recordAppOpenDay = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = today.getTime() - 60 * 24 * 60 * 60 * 1000;
    const days = new Set(getAppOpenDays().filter(t => t >= cutoff));
    days.add(today.getTime());
    try {
      localStorage.setItem(APP_OPEN_DAYS_KEY, JSON.stringify(Array.from(days)));
    } catch {
      /* storage full or unavailable — streak just falls back to sessions */
    }
  };

  const checkStreak = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      // Opening the app counts as an active day, even before any practice.
      recordAppOpenDay();
      try {
        await recordServerActivityDay(user.id);
      } catch {
        /* offline — the local ledger still covers this device */
      }

      // Check if we've already shown streak today using localStorage (persists across sessions)
      const lastShownDate = localStorage.getItem('streak-last-shown-date');
      const today = new Date().toDateString();
      
      if (lastShownDate === today) {
        // Still calculate the streak for the home stats; only suppress the popup.
      }

      // Get user's speeches first
      const { data: userSpeeches } = await supabase
        .from("speeches")
        .select("id, created_at, updated_at")
        .eq("user_id", user.id);

      const userSpeechIds = (userSpeeches || []).map(s => s.id);

      // Check both practice_sessions and presentation_sessions
      const [practiceResult, presentationResult] = userSpeechIds.length
        ? await Promise.all([
            supabase
              .from("practice_sessions")
              .select("session_date, speech_id")
              .in("speech_id", userSpeechIds)
              .order("session_date", { ascending: false }),
            supabase
              .from("presentation_sessions")
              .select("created_at, speech_id")
              .in("speech_id", userSpeechIds)
              .order("created_at", { ascending: false })
          ])
        : [{ data: [] as { session_date: string }[] }, { data: [] as { created_at: string }[] }];

      // Any real activity counts as an active day, also unfinished practice.
      const [masteryResult, beatProgressResult] = await Promise.all([
        supabase.from("mastery_events").select("created_at").eq("user_id", user.id),
        supabase.from("beat_progress").select("updated_at").eq("user_id", user.id),
      ]);

      // Combine all sessions
      const allSessions = [
        ...(practiceResult.data || []).map(s => ({ date: s.session_date })),
        ...(presentationResult.data || []).map(s => ({ date: s.created_at })),
        ...(masteryResult.data || []).map(s => ({ date: s.created_at as string })),
        ...(beatProgressResult.data || []).map(s => ({ date: s.updated_at as string })),
        ...(userSpeeches || []).flatMap(s => [{ date: s.created_at }, { date: s.updated_at }]),
      ];

      console.log('All sessions found:', allSessions.length);


      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const todayTime = todayDate.getTime();

      const uniqueDays = new Set<number>();
      allSessions.forEach(s => {
        const date = new Date(s.date);
        date.setHours(0, 0, 0, 0);
        uniqueDays.add(date.getTime());
      });

      // Days the user simply opened the app count too — otherwise a daily
      // visitor who hasn't finished a practice session loses the streak.
      getAppOpenDays().forEach(t => uniqueDays.add(t));

      // Same ledger from the account, so the streak survives reinstalls and new devices.
      try {
        (await getServerActivityDays(user.id)).forEach(t => uniqueDays.add(t));
      } catch {
        /* offline — fall back to local days only */
      }

      const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
      if (sortedDays.length === 0) return;
      console.log('Unique days:', sortedDays.length, 'Most recent:', new Date(sortedDays[0]).toDateString());

      // Count consecutive days backwards from today (yesterday still counts as
      // alive until the day is over). Step with Date so DST shifts are safe.
      const daySet = new Set(sortedDays);
      const yesterday = new Date(todayDate);
      yesterday.setDate(yesterday.getDate() - 1);

      const cursor: Date | null = daySet.has(todayTime)
        ? new Date(todayDate)
        : daySet.has(yesterday.getTime())
          ? yesterday
          : null;

      let streak = 0;
      while (cursor && daySet.has(cursor.getTime())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
        cursor.setHours(0, 0, 0, 0);
      }

      console.log('Calculated streak:', streak);

      // Show streak celebration if user has practiced at least once
      // (we show their current streak to encourage continuation)
      if (streak > 0) {
        setCurrentStreak(streak);
        setShowStreakCelebration(lastShownDate !== today);
        localStorage.setItem('streak-last-shown-date', today);
        console.log('Showing streak celebration:', streak);
      }
    } catch (error) {
      console.error('Error checking streak:', error);
    }
  };

  const loadSpeeches = async (attempt = 0) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpeeches(data || []);

      // Ask once per login about speeches whose goal date has passed.
      const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
      const expired = (data || []).filter(
        (s) => s.goal_date && s.goal_date < todayStr
      );
      if (expired.length > 0) {
        setExpiredQueue((prev) => {
          const askedIds = new Set(prev.map((p) => p.id));
          const fresh = expired.filter((s) => !askedIds.has(s.id));
          return prev.length > 0 ? prev : fresh;
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSubscriptionTier(effectiveTier(profile.subscription_tier));
      }
    } catch (error: any) {
      // Transient network/session hiccups are common on mobile — retry quietly
      // before bothering the user with an error toast.
      if (attempt < 2) {
        setTimeout(() => loadSpeeches(attempt + 1), 800 * (attempt + 1));
        return;
      }
      toast({
        variant: "destructive",
        title: t('dashboard.errorLoading'),
        description: error.message,
      });
    } finally {
      if (attempt === 0) setLoading(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleSpeechAdded = () => {
    setUploadDialogOpen(false);
    loadSpeeches();
  };

  const currentExpired = expiredQueue[0] ?? null;

  const handleKeepExpired = () => {
    setExpiredQueue((prev) => prev.slice(1));
  };

  const handleDeleteExpired = async () => {
    if (!currentExpired) return;
    setDeletingExpired(true);
    try {
      const { error } = await supabase
        .from("speeches")
        .delete()
        .eq("id", currentExpired.id);
      if (error) throw error;
      setSpeeches((prev) => prev.filter((s) => s.id !== currentExpired.id));
      toast({
        title: t('dashboard.deleted'),
        description: t('dashboard.deletedDesc'),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: error.message,
      });
    } finally {
      setDeletingExpired(false);
      setExpiredQueue((prev) => prev.slice(1));
    }
  };

  // No full-screen loading blocker — show the shell immediately

  return (
    <div className="dashboard">
      {/* Expired speech cleanup — asked once per login */}
      <AlertDialog open={!!currentExpired} onOpenChange={(open) => { if (!open) handleKeepExpired(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.expiredTitle', 'Deadline passed')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.expiredDesc', {
                title: currentExpired?.title ?? '',
                defaultValue: 'The goal date for "{{title}}" has passed. Do you want to delete this speech?',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleKeepExpired} disabled={deletingExpired}>
              {t('dashboard.expiredKeep', 'Keep')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExpired} disabled={deletingExpired}>
              {deletingExpired
                ? t('common.loading', 'Loading...')
                : t('dashboard.expiredDelete', 'Delete speech')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Streak Celebration */}
      {showStreakCelebration && (
        <StreakCelebration 
          streak={currentStreak} 
          onClose={() => setShowStreakCelebration(false)} 
        />
      )}

      <header className="dashboard__header" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="dashboard__toolbar">
          <span className="dashboard__brand">
            Sermable
          </span>

          <div className="s-c5 s-ib s-dn">
            <Button onClick={() => setUploadDialogOpen(true)} variant="apple" size="sm">
              <Plus className="s-fz s-xt" />
              <span className="s-gm s-rp">{t('nav.newSpeech')}</span>
            </Button>

            {!isMobile && (
              <>
                <Button variant="ghost" size="icon" aria-label={t('nav.settings')} onClick={() => navigate("/settings")}>
                  <Settings className="s-g1 s-xv" />
                </Button>
                <Button variant="ghost" size="icon" aria-label={t('nav.signOut')} onClick={handleLogout}>
                  <LogOut className="s-g1 s-xv" />
                </Button>
              </>
            )}

            {/* Mobile Menu */}
            {isMobile && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={t('nav.menu')}>
                    <Menu className="s-g1 s-xv" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="s-3v s-7h s-6x s-qf" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}>
                  <SheetHeader>
                    <SheetTitle className="s-uj">{t('nav.menu')}</SheetTitle>
                  </SheetHeader>
                  <div className="s-c5 s-c7 s-dp s-m1">
                    <Button variant="ghost" className="s-ii" onClick={() => {
                      navigate("/settings");
                      setMobileMenuOpen(false);
                    }}>
                      <Settings className="s-fz s-xt s-lq" />
                      {t('nav.settings')}
                    </Button>
                    <Button variant="ghost" className="s-ii s-u2" onClick={() => {
                      handleLogout();
                      setMobileMenuOpen(false);
                    }}>
                      <LogOut className="s-fz s-xt s-lq" />
                      {t('nav.signOut')}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard__main">
        <div className="dashboard__content">
          {/* Welcome Section - Large, clean typography */}
          <section className="dashboard__greeting" hidden={activeTab !== 'home'}>
            {(() => {
              const hour = new Date().getHours();
              const rawName = user?.user_metadata?.full_name?.split(' ')[0] || "";
              const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : "";
              
              let greeting = "";
              let currentPeriod = "";
              if (hour >= 5 && hour < 11) {
                greeting = t('dashboard.goodMorning');
                currentPeriod = "morning";
              } else if (hour >= 11 && hour < 19) {
                greeting = t('dashboard.welcomeBack');
                currentPeriod = "afternoon";
              } else {
                greeting = t('dashboard.goodEvening');
                currentPeriod = "evening";
              }
              
              const lastShownPeriod = sessionStorage.getItem('greeting_period');
              const greetingText = name ? `${greeting}, ${name}` : greeting;
              
              
              // Mark this period as shown
              sessionStorage.setItem('greeting_period', currentPeriod);
              
              const dateLabel = dateFormatter(i18n.language, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date());

              return (
                <>
                  <p className="s-vj s-d3 s-x1 s-wf s-ul s-jz">
                    {dateLabel}
                  </p>
                  <h1 className="s-tb s-si s-cy s-d3 s-u9 s-jy s-im">
                    {greetingText}
                  </h1>
                  <p className="s-ul s-uk">
                    {t('dashboard.continueOrStart')}
                  </p>
                </>
              );
            })()}
          </section>

          {/* Review Notifications */}

          {activeTab === 'home' && speeches.length > 0 && <TodayTasks tasks={todayTasks(speeches, overview.beats)} onPractice={id => navigate(`/practice/${id}`)} />}
          {activeTab === 'home' && speeches.length > 0 && <SpeechesGlance speeches={speeches} beats={overview.beats} onOpen={() => setActiveTab('speeches')} />}
          {activeTab === 'stats' && <section className="home-statistics"><h1>{t('playful.progress')}</h1><StatsCards streak={currentStreak} />{speeches.map(sp => <SpeechProgress key={sp.id} speech={sp} beats={overview.beats.filter(b => b.speech_id === sp.id)} sessions={overview.sessions.filter(x => x.speech_id === sp.id)} />)}</section>}

          {/* Speeches Section */}
          <section hidden={activeTab === 'stats' || (activeTab === 'home' && speeches.length > 0)}>
            <div className="dashboard__section-heading">
              <div>
                <h1 className="s-vi s-d3 s-u9">{t('playful.mySpeeches')}</h1>
                <p className="s-v9 s-ul s-ls">
                  {t('dashboard.manageSpeeches')}
                </p>
              </div>
              <div className="s-c5 s-ib s-dn">
                {speeches.length > 0 && (
                  <span className="s-vj s-ul s-5t s-or s-oz s-qe">
                    {speeches.length} {speeches.length === 1 ? t('dashboard.speech') : t('dashboard.speeches')}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="s-dm" aria-label={t('dashboard.sort')}>
                      <ArrowUpDown className="s-xt s-fz" />
                      <span className="s-vj s-gm s-rp">{t('dashboard.sort')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="s-4b s-6l s-6x">
                    <DropdownMenuItem onClick={() => setSortBy('deadline')}>
                      {t('dashboard.byDeadline')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('created')}>
                      {t('dashboard.recentlyCreated')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('updated')}>
                      {t('dashboard.recentlyUpdated')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {loading ? (
              <div className="dashboard__loading" role="status" aria-live="polite">
                <span className="dashboard__loading-spinner" aria-hidden="true" />
                <p>{t('common.loading')}</p>
              </div>
            ) : speeches.length === 0 ? (
              <Card className="dashboard__empty">
                <CardContent className="s-p2 s-u0">
                  <SpeechMascot value={0} />
                  <h3 className="s-vi s-d3 s-u9 s-jy">{t('dashboard.noSpeeches')}</h3>
                  <p className="s-ul s-k2 s-js s-m9 s-ip">
                    {t('dashboard.noSpeechesDesc')}
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} variant="apple" size="lg">
                    <Plus className="s-g1 s-xv" />
                    {t('dashboard.uploadFirst')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="dashboard__list">
                {(() => {
                  const sortedSpeeches = [...speeches].sort((a, b) => {
                    if (sortBy === 'deadline') {
                      if (!a.goal_date && !b.goal_date) return 0;
                      if (!a.goal_date) return 1;
                      if (!b.goal_date) return -1;
                      return new Date(a.goal_date).getTime() - new Date(b.goal_date).getTime();
                    } else if (sortBy === 'created') {
                      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    } else {
                      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
                    }
                  });

                  return sortedSpeeches.map((speech) => (
                    <div 
                      key={speech.id}
                    >
                      <SpeechCard 
                        speech={speech} 
                        onUpdate={loadSpeeches} 
                        subscriptionTier={subscriptionTier}
                        totalSpeeches={speeches.length}
                      />
                    </div>
                  ));
                })()}
              </div>
            )}
          </section>
        </div>
      </main>
      <BottomNav active={activeTab} onChange={tab => { setActiveTab(tab); window.scrollTo?.(0, 0); }} />


      <Suspense fallback={null}>
        {uploadDialogOpen && (
          <UploadSpeechDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            onSuccess={handleSpeechAdded}
          />
        )}
      </Suspense>
    </div>
  );
};

export default Dashboard;
