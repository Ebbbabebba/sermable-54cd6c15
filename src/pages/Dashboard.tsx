import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, LogOut, BookOpen, Calendar, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import UploadSpeechDialog from "@/components/UploadSpeechDialog";
import SpeechCard from "@/components/SpeechCard";
import BottomNav from "@/components/BottomNav";

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
  const navigate = useNavigate();
  const { toast } = useToast();

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
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSpeeches(data || []);
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
    <div className="min-h-screen flex flex-col pb-24 bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card/80 border-b border-border/30 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">Dryrun</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hover-scale">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 overflow-y-auto">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="animate-slide-up">
            <h2 className="text-4xl font-bold mb-3 bg-gradient-primary bg-clip-text text-transparent">
              Welcome back, {user?.user_metadata?.full_name || "there"}! 👋
            </h2>
            <p className="text-lg text-muted-foreground">
              Continue practicing or start a new speech.
            </p>
          </div>

          {/* Stats Cards */}
          {speeches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-scale-in">
              <Card className="card-apple border-primary/20 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Speeches</CardTitle>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">{speeches.length}</div>
                  <p className="text-xs text-muted-foreground mt-1">Learning materials</p>
                </CardContent>
              </Card>

              <Card className="card-apple border-secondary/20 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Goals</CardTitle>
                  <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-secondary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">
                    {speeches.filter((s) => new Date(s.goal_date) >= new Date()).length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Upcoming deadlines</p>
                </CardContent>
              </Card>

              <Card className="card-apple border-accent/20 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-accent opacity-0 group-hover:opacity-5 transition-opacity"></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Practice Sessions</CardTitle>
                  <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-foreground">0</div>
                  <p className="text-xs text-muted-foreground mt-1">Total completed</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Speeches Section */}
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between animate-fade-in">
              <div>
                <h3 className="text-2xl font-bold">Your Speeches</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage and practice your speeches
                </p>
              </div>
              <Button onClick={() => setUploadDialogOpen(true)} className="hover-scale bg-gradient-primary shadow-md hover:shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                New Speech
              </Button>
            </div>

            {speeches.length === 0 ? (
              <Card className="card-apple p-12 text-center overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
                <div className="relative">
                  <div className="mx-auto w-28 h-28 rounded-full bg-gradient-primary/10 flex items-center justify-center mb-6 animate-float">
                    <BookOpen className="h-14 w-14 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">No speeches yet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto text-base">
                    Upload your first speech to start practicing. Set a goal date and let AI help you memorize it.
                  </p>
                  <Button onClick={() => setUploadDialogOpen(true)} className="hover-scale bg-gradient-primary shadow-lg hover:shadow-xl">
                    <Plus className="h-5 w-5 mr-2" />
                    Upload Your First Speech
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {speeches.map((speech, i) => (
                  <div 
                    key={speech.id}
                    className="animate-slide-up"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <SpeechCard speech={speech} onUpdate={loadSpeeches} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <UploadSpeechDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={handleSpeechAdded}
      />
      
      <BottomNav />
    </div>
  );
};

export default Dashboard;
