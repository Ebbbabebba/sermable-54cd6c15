import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar, Target, Award } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const ProgressPage = () => {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-24">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <header className="bg-card border-b border-border/50 backdrop-blur-lg bg-card/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">Progress</h1>
          <p className="text-muted-foreground mt-1">Track your learning journey</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 space-y-6 animate-fade-in">
        <Card className="card-apple">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Overall Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Mastery Level</span>
                <span className="text-sm text-muted-foreground">0%</span>
              </div>
              <Progress value={0} className="h-2 progress-animate" />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="card-apple hover-scale">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Practice Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0 days</p>
              <p className="text-sm text-muted-foreground mt-1">Keep practicing daily!</p>
            </CardContent>
          </Card>

          <Card className="card-apple hover-scale">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Sessions Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">0</p>
              <p className="text-sm text-muted-foreground mt-1">Start your first session</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-apple">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Complete your first practice session to unlock achievements!</p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProgressPage;
