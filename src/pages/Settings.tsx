import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import LanguagePreference from "@/components/LanguagePreference";
import BottomNav from "@/components/BottomNav";

const Settings = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border/50 backdrop-blur-lg bg-card/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="hover-scale">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex-1 overflow-y-auto">
        <div className="space-y-8 max-w-2xl mx-auto">
          {/* Profile Section */}
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold mb-2">Profile</h2>
            <p className="text-muted-foreground mb-4">
              Manage your account settings and preferences
            </p>
            <div className="bg-card rounded-2xl p-6 border border-border/50">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          {/* Language Preference */}
          <div className="animate-slide-up">
            <LanguagePreference />
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Settings;
