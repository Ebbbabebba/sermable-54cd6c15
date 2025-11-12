import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, BookOpen, Calendar, TrendingUp, Settings, Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import UploadSpeechDialog from "@/components/UploadSpeechDialog";
import SpeechCard from "@/components/SpeechCard";
import ReviewNotifications from "@/components/ReviewNotifications";
import PracticeHeatmap from "@/components/PracticeHeatmap";
import StreakCelebration from "@/components/StreakCelebration";
import { startOfDay, differenceInDays } from "date-fns";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
  goal_date: string;
  created_at: string;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const [monthlySpeeches, setMonthlySpeeches] = useState(0);
  const [showStreakCelebration, setShowStreakCelebration] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      loadSpeeches();
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

      // Load subscription info
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_tier, monthly_speeches_count")
        .eq("id", user.id)
        .single();

      if (profile) {
        setSubscriptionTier(profile.subscription_tier);
        setMonthlySpeeches(profile.monthly_speeches_count);
      }

      // Load streak data and show celebration
      await loadStreakData();
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

  const loadStreakData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all practice sessions
      const { data: practiceSessions } = await supabase
        .from("practice_sessions")
        .select("session_date")
        .order("session_date", { ascending: false });

      const { data: presentationSessions } = await supabase
        .from("presentation_sessions")
        .select("created_at")
        .order("created_at", { ascending: false });

      // Combine and get unique practice days
      const allDates = new Set<string>();
      
      practiceSessions?.forEach(session => {
        const date = startOfDay(new Date(session.session_date)).toISOString();
        allDates.add(date);
      });

      presentationSessions?.forEach(session => {
        const date = startOfDay(new Date(session.created_at)).toISOString();
        allDates.add(date);
      });

      const uniqueDates = Array.from(allDates)
        .map(d => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      if (uniqueDates.length === 0) {
        setCurrentStreak(0);
        return;
      }

      // Calculate current streak
      let streak = 0;
      const today = startOfDay(new Date());
      
      const mostRecentPractice = uniqueDates[0];
      const daysSinceLastPractice = differenceInDays(today, mostRecentPractice);
      
      if (daysSinceLastPractice <= 1) {
        streak = 1;
        
        for (let i = 1; i < uniqueDates.length; i++) {
          const currentDate = uniqueDates[i];
          const previousDate = uniqueDates[i - 1];
          const daysDiff = differenceInDays(previousDate, currentDate);
          
          if (daysDiff === 1) {
            streak++;
          } else {
            break;
          }
        }
      }

      setCurrentStreak(streak);
      
      // Show celebration if streak > 0
      if (streak > 0) {
        const hasSeenStreakToday = sessionStorage.getItem(`streak-seen-${today.toISOString()}`);
        if (!hasSeenStreakToday) {
          setShowStreakCelebration(true);
          sessionStorage.setItem(`streak-seen-${today.toISOString()}`, 'true');
        }
      }
    } catch (error) {
      console.error("Error loading streak data:", error);
    }
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
        title: "Upgraded to Premium!",
        description: "You now have access to all premium features.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upgrade failed",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your speeches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm flex-shrink-0">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sermable</h1>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-4">
              <Button onClick={() => setUploadDialogOpen(true)} variant="default">
                <Plus className="h-4 w-4 mr-2" />
                New Speech
              </Button>
              <div className="text-sm">
                <span className="font-medium capitalize">{subscriptionTier}</span> Plan
                {subscriptionTier === 'free' && (
                  <span className="text-muted-foreground ml-2">
                    ({monthlySpeeches}/2 speeches this month)
                  </span>
                )}
              </div>
              {subscriptionTier === 'free' && (
                <Button variant="default" size="sm" onClick={handleUpgradeToPremium}>
                  Upgrade to Premium
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  <div className="text-sm pb-4 border-b">
                    <span className="font-medium capitalize">{subscriptionTier}</span> Plan
                    {subscriptionTier === 'free' && (
                      <div className="text-muted-foreground mt-1">
                        {monthlySpeeches}/2 speeches this month
                      </div>
                    )}
                  </div>
                  {subscriptionTier === 'free' && (
                    <Button variant="default" onClick={() => {
                      handleUpgradeToPremium();
                      setMobileMenuOpen(false);
                    }}>
                      Upgrade to Premium
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => {
                    navigate("/settings");
                    setMobileMenuOpen(false);
                  }}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                  <Button variant="outline" onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24 overflow-y-auto flex-1">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back, {user?.user_metadata?.full_name || "there"}!
            </h2>
            <p className="text-muted-foreground">
              Continue practicing or start a new speech.
            </p>
          </div>

          {/* Review Notifications */}
          <ReviewNotifications />

          {/* Practice Heatmap */}
          <PracticeHeatmap />

          {/* Ad Placeholder - Free Users */}
          {subscriptionTier === 'free' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Ad Space - Upgrade to remove ads</p>
              </CardContent>
            </Card>
          )}

          {/* Stats Cards */}
          {speeches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Speeches</CardTitle>
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{speeches.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {speeches.filter((s) => new Date(s.goal_date) >= new Date()).length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Practice Sessions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Speeches Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Your Speeches</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and practice your speeches
                </p>
              </div>
            </div>

            {speeches.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No speeches yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Upload your first speech to start practicing. Set a goal date and let AI help you memorize it.
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Your First Speech
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {speeches.map((speech) => (
                  <SpeechCard key={speech.id} speech={speech} onUpdate={loadSpeeches} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button - Mobile Only */}
      {isMobile && (
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="fixed bottom-20 right-6 h-16 w-16 rounded-full shadow-lg z-50"
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

      <StreakCelebration
        currentStreak={currentStreak}
        show={showStreakCelebration}
        onHide={() => setShowStreakCelebration(false)}
      />
    </div>
  );
};

export default Dashboard;
