import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Languages, Globe, Bell, Flame, TrendingUp, Shield } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { startOfDay, differenceInDays } from "date-fns";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'student' | 'regular' | 'enterprise'>('free');
  const { notificationsEnabled, registerPushNotifications } = usePushNotifications();
  const isNativePlatform = Capacitor.isNativePlatform();

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
  ];

  const handleLanguageChange = (langCode: string) => {
    i18n.changeLanguage(langCode);
    setCurrentLanguage(langCode);
    localStorage.setItem('preferredLanguage', langCode);
  };

  useEffect(() => {
    // Sync with current language on mount
    setCurrentLanguage(i18n.language);
    
    // Load user data
    const loadUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Load profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("skill_level, subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSkillLevel((profile.skill_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced');
          setSubscriptionTier(profile.subscription_tier);
        }

        // Load streak data
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
          setBestStreak(0);
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

        // Calculate best streak
        let longestStreak = 0;
        let tempStreak = 1;
        
        for (let i = 1; i < uniqueDates.length; i++) {
          const daysDiff = differenceInDays(uniqueDates[i - 1], uniqueDates[i]);
          
          if (daysDiff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);
        setBestStreak(longestStreak);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [i18n.language]);

  const handleSkillLevelChange = async (level: 'beginner' | 'intermediate' | 'advanced') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ skill_level: level })
        .eq("id", user.id);

      if (error) throw error;

      setSkillLevel(level);
      toast({
        title: "Skill level updated",
        description: "Your practice schedule will be adjusted accordingly",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to update skill level",
        description: error.message,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common.back')}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="space-y-6">
          <div className="animate-fade-in">
            <h1 className="text-4xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Customize your Sermable experience
            </p>
          </div>

          {/* Language Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                <CardTitle>Language & Region</CardTitle>
              </div>
              <CardDescription>
                Choose your preferred language for the app interface. Text language is detected automatically when you paste content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="app-language" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  App Interface Language
                </Label>
                <Select
                  value={currentLanguage}
                  onValueChange={handleLanguageChange}
                >
                  <SelectTrigger id="app-language" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <div className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The app will display menus, buttons, and settings in this language.
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Languages className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Automatic Text Language Detection</p>
                    <p className="text-xs text-muted-foreground">
                      When you paste speech text, Sermable automatically detects the language and updates the interface to match. This ensures a seamless experience in your preferred language.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile & Streak */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Your practice progress and achievements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Streak Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <Flame className="h-8 w-8 text-warning" />
                  <div>
                    <div className="text-2xl font-bold">{currentStreak}</div>
                    <div className="text-xs text-muted-foreground">Current Streak</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{bestStreak}</div>
                    <div className="text-xs text-muted-foreground">Best Streak</div>
                  </div>
                </div>
              </div>

              {subscriptionTier !== 'free' && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Streak Freeze</p>
                        <p className="text-xs text-muted-foreground">
                          Premium feature - Coming soon
                        </p>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">0 available</div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>
                Manage your account settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Skill Level */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="skill-level">Speaking Skill Level</Label>
                  <p className="text-sm text-muted-foreground">
                    This adjusts your practice schedule and notification frequency
                  </p>
                </div>
                <Select value={skillLevel} onValueChange={(value) => handleSkillLevelChange(value as 'beginner' | 'intermediate' | 'advanced')}>
                  <SelectTrigger id="skill-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">
                      <div className="flex flex-col">
                        <span>Beginner</span>
                        <span className="text-xs text-muted-foreground">
                          Slower pace, more frequent reviews
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="intermediate">
                      <div className="flex flex-col">
                        <span>Intermediate</span>
                        <span className="text-xs text-muted-foreground">
                          Balanced progression
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="advanced">
                      <div className="flex flex-col">
                        <span>Advanced</span>
                        <span className="text-xs text-muted-foreground">
                          Faster pace, longer intervals
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Personalized Learning</p>
                <p className="text-xs text-muted-foreground">
                  Your skill level combined with speech deadlines determines review frequency. Advanced speakers progress faster with longer intervals between reviews, while beginners get more frequent practice sessions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>
                Get reminders when speeches are due for review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isNativePlatform ? (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm font-medium">Native App Required</p>
                  <p className="text-xs text-muted-foreground">
                    Lock screen push notifications are only available in the native mobile app. 
                    To get notifications on your iPhone or Android device, you'll need to install the app.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Receive reminders on your lock screen
                      </p>
                    </div>
                    <Switch
                      checked={notificationsEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          registerPushNotifications();
                        }
                      }}
                    />
                  </div>
                  
                  {notificationsEnabled && (
                    <div className="rounded-lg bg-primary/10 p-3">
                      <p className="text-xs text-muted-foreground">
                        ✓ You'll receive notifications when speeches are due for review based on your progress.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;
