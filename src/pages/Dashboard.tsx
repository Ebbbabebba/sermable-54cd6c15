import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, LogOut, BookOpen, Settings, Menu, ArrowUpDown, Mic } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UploadSpeechDialog from "@/components/UploadSpeechDialog";
import SpeechCard from "@/components/SpeechCard";
import ReviewNotifications from "@/components/ReviewNotifications";
import StreakCelebration from "@/components/StreakCelebration";
import { useTheme } from "@/contexts/ThemeContext";

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
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [monthlySpeeches, setMonthlySpeeches] = useState(0);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sortBy, setSortBy] = useState<'deadline' | 'created' | 'updated'>('deadline');
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadSpeeches();
      checkStreak();
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkStreak = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const hasShownToday = sessionStorage.getItem('streak-shown-today');
      if (hasShownToday === new Date().toDateString()) {
        return;
      }

      const { data: sessions, error: sessionsError } = await supabase
        .from("practice_sessions")
        .select("session_date, speech_id")
        .order("session_date", { ascending: false });

      if (sessionsError) throw sessionsError;

      const { data: userSpeeches } = await supabase
        .from("speeches")
        .select("id")
        .eq("user_id", user.id);

      if (!userSpeeches || !sessions) return;

      const userSpeechIds = new Set(userSpeeches.map(s => s.id));
      const userSessions = sessions.filter(s => userSpeechIds.has(s.speech_id));

      let streak = 0;
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

      for (let i = 0; i < sortedDays.length; i++) {
        const daysDiff = Math.floor((today.getTime() - sortedDays[i]) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === i) {
          streak++;
        } else {
          break;
        }
      }

      if (streak > 0) {
        setCurrentStreak(streak);
        setShowStreakCelebration(true);
        sessionStorage.setItem('streak-shown-today', new Date().toDateString());
      }
    } catch (error) {
      console.error('Error checking streak:', error);
    }
  };

  const loadSpeeches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpeeches(data || []);

      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, monthly_speeches_count")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSubscriptionTier(profile.subscription_tier);
        setMonthlySpeeches(profile.monthly_speeches_count);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading speeches",
        description: error.message,
      });
    } finally {
      setLoading(false);
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

  const handleUpgradeToPremium = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: 'regular' })
        .eq('id', user.id);

      if (error) throw error;

      setSubscriptionTier('regular');
      toast({
        title: t('dashboard.upgraded'),
        description: t('dashboard.upgradedDesc'),
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('dashboard.upgradeFailed'),
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">{t('dashboard.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Streak Celebration */}
      {showStreakCelebration && (
        <StreakCelebration 
          streak={currentStreak} 
          onClose={() => setShowStreakCelebration(false)} 
        />
      )}

      {/* Apple-style Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Sermable</h1>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setUploadDialogOpen(true)} variant="apple" size="sm">
                <Plus className="h-4 w-4" />
                {t('nav.newSpeech')}
              </Button>
              
              <div className="flex items-center gap-1 ml-2">
                <span className="text-xs text-muted-foreground capitalize px-2 py-1 bg-secondary rounded-full">
                  {subscriptionTier}
                  {subscriptionTier === 'free' && ` · ${monthlySpeeches}/2`}
                </span>
                
                {subscriptionTier === 'free' && (
                  <Button variant="apple-ghost" size="sm" onClick={handleUpgradeToPremium}>
                    {t('nav.upgrade')}
                  </Button>
                )}
              </div>
              
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="bg-card border-l border-border">
                <SheetHeader>
                  <SheetTitle className="text-left">{t('nav.menu')}</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-3 mt-8">
                  <div className="pb-4 border-b border-border">
                    <span className="text-sm text-muted-foreground capitalize">{subscriptionTier} {t('dashboard.plan')}</span>
                    {subscriptionTier === 'free' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {monthlySpeeches}/2 {t('dashboard.speechesThisMonth')}
                      </p>
                    )}
                  </div>
                  {subscriptionTier === 'free' && (
                    <Button variant="apple" onClick={() => {
                      handleUpgradeToPremium();
                      setMobileMenuOpen(false);
                    }}>
                      {t('nav.upgradeToPremium')}
                    </Button>
                  )}
                  <Button variant="ghost" className="justify-start" onClick={() => {
                    navigate("/settings");
                    setMobileMenuOpen(false);
                  }}>
                    <Settings className="h-4 w-4 mr-3" />
                    {t('nav.settings')}
                  </Button>
                  <Button variant="ghost" className="justify-start text-destructive" onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}>
                    <LogOut className="h-4 w-4 mr-3" />
                    {t('nav.signOut')}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 pb-28">
        <div className="space-y-10">
          {/* Welcome Section - Large, clean typography */}
          <section className="animate-fade-in">
            <h2 className="text-3xl font-semibold text-foreground mb-1">
              {(() => {
                const hour = new Date().getHours();
                const rawName = user?.user_metadata?.full_name?.split(' ')[0] || "";
                const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : "";
                
                if (hour >= 5 && hour < 11) {
                  return `God morgon${name ? `, ${name}` : ""}.`;
                } else if (hour >= 11 && hour < 19) {
                  return `Välkommen tillbaka${name ? `, ${name}` : ""}.`;
                } else {
                  return `God kväll${name ? `, ${name}` : ""}.`;
                }
              })()}
            </h2>
            <p className="text-muted-foreground text-lg">
              {t('dashboard.continueOrStart')}
            </p>
          </section>

          {/* Review Notifications */}
          <ReviewNotifications />

          {/* Ad Placeholder - Free Users */}
          {subscriptionTier === 'free' && (
            <Card className="bg-secondary/50 border-0">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">{t('dashboard.adSpace')}</p>
              </CardContent>
            </Card>
          )}

          {/* Speeches Section */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground">{t('dashboard.yourSpeeches')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('dashboard.manageSpeeches')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {speeches.length > 0 && (
                  <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
                    {speeches.length} {speeches.length === 1 ? t('dashboard.speech') : t('dashboard.speeches')}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <ArrowUpDown className="w-4 h-4" />
                      <span className="text-xs hidden sm:inline">{t('dashboard.sort')}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border border-border">
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

            {speeches.length === 0 ? (
              <Card className="border-0 shadow-apple-xl animate-fade-in">
                <CardContent className="py-16 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <Mic className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{t('dashboard.noSpeeches')}</h3>
                  <p className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed">
                    {t('dashboard.noSpeechesDesc')}
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} variant="apple" size="lg">
                    <Plus className="h-5 w-5" />
                    {t('dashboard.uploadFirst')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

                  return sortedSpeeches.map((speech, index) => (
                    <div 
                      key={speech.id}
                      className="animate-scale-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <SpeechCard speech={speech} onUpdate={loadSpeeches} />
                    </div>
                  ));
                })()}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Floating Action Button - Mobile */}
      {isMobile && (
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-apple-xl z-50"
          variant="apple"
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      <UploadSpeechDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleSpeechAdded}
      />
    </div>
  );
};

export default Dashboard;
