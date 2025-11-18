import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, BookOpen, Calendar, TrendingUp, Settings, Menu, ArrowUpDown } from "lucide-react";
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

      // Check if we've already shown the streak today
      const hasShownToday = sessionStorage.getItem('streak-shown-today');
      if (hasShownToday === new Date().toDateString()) {
        return;
      }

      // Get all practice sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from("practice_sessions")
        .select("session_date, speech_id")
        .order("session_date", { ascending: false });

      if (sessionsError) throw sessionsError;

      // Get user's speeches to verify ownership
      const { data: userSpeeches } = await supabase
        .from("speeches")
        .select("id")
        .eq("user_id", user.id);

      if (!userSpeeches || !sessions) return;

      const userSpeechIds = new Set(userSpeeches.map(s => s.id));
      const userSessions = sessions.filter(s => userSpeechIds.has(s.speech_id));

      // Calculate streak
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-secondary/20">
      {/* Streak Celebration */}
      {showStreakCelebration && (
        <StreakCelebration 
          streak={currentStreak} 
          onClose={() => setShowStreakCelebration(false)} 
        />
      )}

      {/* Header */}
      <header className="border-b border-border/40 backdrop-blur-lg bg-background/80 sticky top-0 z-50 flex-shrink-0 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Sermable</h1>
          
          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-3">
              <Button onClick={() => setUploadDialogOpen(true)} variant="gradient">
                <Plus className="h-4 w-4 mr-2" />
                New Speech
              </Button>
              <div className="text-sm px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
                <span className="capitalize">{subscriptionTier}</span>
                {subscriptionTier === 'free' && (
                  <span className="ml-2">
                    {monthlySpeeches}/2
                  </span>
                )}
              </div>
              {subscriptionTier === 'free' && (
                <Button variant="default" size="sm" onClick={handleUpgradeToPremium}>
                  Upgrade
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="rounded-full">
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
                <LogOut className="h-5 w-5" />
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
            <h2 className="text-3xl font-bold mb-2 capitalize">
              Welcome back, {user?.user_metadata?.full_name || "there"}!
            </h2>
            <p className="text-muted-foreground">
              Continue practicing or start a new speech.
            </p>
          </div>

          {/* Review Notifications */}
          <ReviewNotifications />

          {/* Ad Placeholder - Free Users */}
          {subscriptionTier === 'free' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Ad Space - Upgrade to remove ads</p>
              </CardContent>
            </Card>
          )}

          {/* Speeches Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Your Speeches</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and practice your speeches
                </p>
              </div>
              <div className="flex items-center gap-2">
                {speeches.length > 0 && (
                  <div className="text-xs px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground font-medium">
                    {speeches.length} {speeches.length === 1 ? 'speech' : 'speeches'}
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ArrowUpDown className="w-4 h-4" />
                      <span className="text-xs">Sort</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortBy('deadline')}>
                      By Deadline
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('created')}>
                      Recently Created
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortBy('updated')}>
                      Recently Updated
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {speeches.length === 0 ? (
              <Card className="shadow-xl border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-sm animate-fade-in">
                <CardContent className="py-16 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 animate-float">
                    <BookOpen className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No speeches yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto text-base">
                    Upload your first speech to start practicing. Set a goal date and let AI help you memorize it.
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} variant="gradient" size="lg">
                    <Plus className="h-5 w-5 mr-2" />
                    Upload Your First Speech
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(() => {
                  // Sort speeches based on selected criteria
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
          </div>
        </div>
      </main>

      {/* Floating Action Button - Mobile Only */}
      {isMobile && (
        <Button
          onClick={() => setUploadDialogOpen(true)}
          className="fixed bottom-20 right-6 h-16 w-16 rounded-full shadow-2xl z-50 animate-pulse-glow"
          variant="gradient"
          size="icon"
        >
          <Plus className="h-7 w-7" />
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
