import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Languages, Globe, Bell, Flame, Trophy, Crown, Check, GraduationCap } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Settings = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const { notificationsEnabled, registerPushNotifications } = usePushNotifications();
  const isNativePlatform = Capacitor.isNativePlatform();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showStudentPricing, setShowStudentPricing] = useState(false);

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

        const { data: profile } = await supabase
          .from("profiles")
          .select("skill_level")
          .eq("id", user.id)
          .single();

        if (profile) {
          setSkillLevel((profile.skill_level || 'beginner') as 'beginner' | 'intermediate' | 'advanced');
        }

        // Calculate streak
        const { data: sessions } = await supabase
          .from("practice_sessions")
          .select("session_date, speech_id")
          .order("session_date", { ascending: false });

        const { data: userSpeeches } = await supabase
          .from("speeches")
          .select("id")
          .eq("user_id", user.id);

        if (!userSpeeches || !sessions) return;

        const userSpeechIds = new Set(userSpeeches.map(s => s.id));
        const userSessions = sessions.filter(s => userSpeechIds.has(s.speech_id));

        // Calculate current streak
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

        let streak = 0;
        for (let i = 0; i < sortedDays.length; i++) {
          const daysDiff = Math.floor((today.getTime() - sortedDays[i]) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === i) {
            streak++;
          } else {
            break;
          }
        }

        setCurrentStreak(streak);

        // Calculate best streak
        let maxStreak = 0;
        let tempStreak = 0;
        let prevDay = null;

        for (const day of sortedDays) {
          if (prevDay === null) {
            tempStreak = 1;
          } else {
            const diff = Math.floor((prevDay - day) / (1000 * 60 * 60 * 24));
            if (diff === 1) {
              tempStreak++;
            } else {
              maxStreak = Math.max(maxStreak, tempStreak);
              tempStreak = 1;
            }
          }
          prevDay = day;
        }
        maxStreak = Math.max(maxStreak, tempStreak);
        setBestStreak(maxStreak);

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

          {/* Subscription Section */}
          <Card className="border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <CardDescription>
                Unlock premium features and enhance your learning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Premium Features */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Why Premium?</h3>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Override Spaced Repetition Lock</p>
                      <p className="text-sm text-muted-foreground">Practice anytime with "Practice Anyway" button</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Unlimited Speeches</p>
                      <p className="text-sm text-muted-foreground">Upload and practice unlimited speech texts</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Advanced Analytics</p>
                      <p className="text-sm text-muted-foreground">Detailed performance insights and progress tracking</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Streak Freeze</p>
                      <p className="text-sm text-muted-foreground">Protect your streak when life gets busy</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Priority Support</p>
                      <p className="text-sm text-muted-foreground">Get help faster with dedicated support</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pricing Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Choose Your Plan</h3>
                
                {showStudentPricing ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-4">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      <p className="text-sm font-medium">Student Pricing</p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Monthly Student Plan</p>
                          <p className="text-sm text-muted-foreground">Billed monthly</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€3.90</p>
                          <p className="text-xs text-muted-foreground line-through">€7.90</p>
                          <p className="text-xs text-primary">50% off</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('annual')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Annual Student Plan</p>
                          <p className="text-sm text-muted-foreground">Billed yearly • Save 33%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€39.90</p>
                          <p className="text-xs text-muted-foreground line-through">€79.90</p>
                          <p className="text-xs text-primary">50% off</p>
                        </div>
                      </div>
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowStudentPricing(false)}
                      className="w-full"
                    >
                      Back to regular pricing
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={() => setSelectedPlan('monthly')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                        selectedPlan === 'monthly'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Monthly Plan</p>
                          <p className="text-sm text-muted-foreground">Billed monthly</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€7.90</p>
                          <p className="text-xs text-muted-foreground">per month</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedPlan('annual')}
                      className={`w-full p-4 rounded-lg border-2 transition-all text-left relative overflow-hidden ${
                        selectedPlan === 'annual'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-md font-medium">
                        Save 33%
                      </div>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Annual Plan</p>
                          <p className="text-sm text-muted-foreground">Billed yearly</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">€79.90</p>
                          <p className="text-xs text-muted-foreground">€6.66/month</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Student Button */}
              {!showStudentPricing && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowStudentPricing(true)}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Student? Click here!
                </Button>
              )}

              {/* Continue Button */}
              <Button
                className="w-full"
                size="lg"
                disabled={!selectedPlan}
                onClick={() => {
                  toast({
                    title: "Coming soon!",
                    description: "Premium subscription will be available soon.",
                  });
                }}
              >
                Continue with {selectedPlan === 'monthly' ? 'Monthly' : selectedPlan === 'annual' ? 'Annual' : ''} Plan
              </Button>
            </CardContent>
          </Card>

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
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle>Profile & Streak</CardTitle>
              </div>
              <CardDescription>
                Track your practice consistency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Flame className="h-4 w-4" />
                    <span className="text-sm">Current Streak</span>
                  </div>
                  <div className="text-3xl font-bold">{currentStreak}</div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">Best Streak</span>
                  </div>
                  <div className="text-3xl font-bold">{bestStreak}</div>
                  <div className="text-xs text-muted-foreground">days</div>
                </div>
              </div>

              <div className="rounded-lg bg-primary/10 p-4 space-y-2">
                <p className="text-sm font-medium">Keep your streak alive!</p>
                <p className="text-xs text-muted-foreground">
                  Practice at least once every day to maintain your streak. Your streak resets if you miss a day.
                </p>
              </div>
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
