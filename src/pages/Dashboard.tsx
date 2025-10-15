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
import LanguagePreference from "@/components/LanguagePreference";
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
    <div className="min-h-screen flex flex-col pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border/50 backdrop-blur-lg bg-card/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Dryrun</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hover-scale">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 overflow-y-auto">
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

          {/* Stats Cards */}
          {speeches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
              <Card className="card-apple hover-scale">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Speeches</CardTitle>
                  <BookOpen className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{speeches.length}</div>
                </CardContent>
              </Card>

              <Card className="card-apple hover-scale">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
                  <Calendar className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {speeches.filter((s) => new Date(s.goal_date) >= new Date()).length}
                  </div>
                </CardContent>
              </Card>

              <Card className="card-apple hover-scale">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Practice Sessions</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Language Preference */}
          <LanguagePreference />

          {/* Speeches Section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">Your Speeches</h3>
                <p className="text-sm text-muted-foreground">
                  Manage and practice your speeches
                </p>
              </div>
              <Button onClick={() => setUploadDialogOpen(true)} className="hover-scale">
                <Plus className="h-4 w-4 mr-2" />
                New Speech
              </Button>
            </div>

            {speeches.length === 0 ? (
              <Card className="card-apple p-12 text-center">
                <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4 animate-scale-in">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No speeches yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Upload your first speech to start practicing. Set a goal date and let AI help you memorize it.
                </p>
                <Button onClick={() => setUploadDialogOpen(true)} className="hover-scale">
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
