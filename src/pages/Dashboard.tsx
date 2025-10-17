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
    <div className="min-h-screen flex flex-col pb-24 bg-background">
      {/* Header */}
      <header className="bg-card sticky top-0 z-40 border-b border-border">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-primary">Dryrun</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 flex-1 overflow-y-auto">
        <div className="space-y-8 max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="animate-fade-in">
            <h2 className="text-3xl font-bold mb-2">
              Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
            </h2>
            <p className="text-muted-foreground">
              Continue practicing or start a new speech
            </p>
          </div>

          {/* Stats Cards */}
          {speeches.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="card-pinterest p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Speeches</div>
                </div>
                <div className="text-2xl font-bold">{speeches.length}</div>
              </div>

              <div className="card-pinterest p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Active Goals</div>
                </div>
                <div className="text-2xl font-bold">
                  {speeches.filter((s) => new Date(s.goal_date) >= new Date()).length}
                </div>
              </div>

              <div className="card-pinterest p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">Sessions</div>
                </div>
                <div className="text-2xl font-bold">0</div>
              </div>
            </div>
          )}

          {/* Speeches Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold">Your Speeches</h3>
              <Button onClick={() => setUploadDialogOpen(true)} className="rounded-full" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Speech
              </Button>
            </div>

            {speeches.length === 0 ? (
              <div className="card-pinterest p-16 text-center max-w-md mx-auto">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <BookOpen className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No speeches yet</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Upload your first speech to start practicing
                </p>
                <Button onClick={() => setUploadDialogOpen(true)} className="rounded-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Speech
                </Button>
              </div>
            ) : (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {speeches.map((speech) => (
                  <div key={speech.id} className="break-inside-avoid">
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
