import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Brain, Sparkles, Clock, ChevronRight } from "lucide-react";

interface SleepAwareSuggestion {
  type: 'evening_practice' | 'morning_recall' | 'optimal_time' | 'none';
  speechId?: string;
  speechTitle?: string;
  message: string;
  subMessage: string;
  icon: 'moon' | 'sun' | 'brain' | 'clock';
}

const SleepAwareScheduling = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [suggestion, setSuggestion] = useState<SleepAwareSuggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSleepAwareSuggestion();
  }, []);

  const checkSleepAwareSuggestion = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const hour = new Date().getHours();
      
      // Get user's speeches with upcoming deadlines
      const { data: speeches } = await supabase
        .from("speeches")
        .select("id, title, goal_date, last_practice_session_at")
        .order("goal_date", { ascending: true })
        .limit(5);

      if (!speeches || speeches.length === 0) {
        setLoading(false);
        return;
      }

      // Check for last evening practice (stored in localStorage)
      const lastEveningPractice = localStorage.getItem('last-evening-practice');
      const lastEveningData = lastEveningPractice ? JSON.parse(lastEveningPractice) : null;
      
      // ONLY show morning recall prompt - user is already in app to practice otherwise
      // Morning time (6 AM - 10 AM) - Suggest morning recall if practiced last night
      if (hour >= 6 && hour < 10 && lastEveningData) {
        const lastPracticeDate = new Date(lastEveningData.timestamp);
        const today = new Date();
        
        // Check if practiced last evening (within last 12 hours)
        const hoursSinceEvening = (today.getTime() - lastPracticeDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceEvening < 14 && hoursSinceEvening > 4) {
          // Find the speech they practiced
          const practicedSpeech = speeches.find(s => s.id === lastEveningData.speechId);
          
          if (practicedSpeech) {
            setSuggestion({
              type: 'morning_recall',
              speechId: practicedSpeech.id,
              speechTitle: practicedSpeech.title,
              message: t('sleepScheduling.morningRecall', 'Morning Memory Test'),
              subMessage: t('sleepScheduling.morningRecallDesc', 'Your brain consolidated memories overnight. Test your recall of "{{title}}" now for maximum retention!', { title: practicedSpeech.title }),
              icon: 'sun'
            });
            setLoading(false);
            return;
          }
        }
      }
      
      // For all other times - no in-app suggestions needed
      // Evening reminders will be sent via push notifications instead

      setLoading(false);
    } catch (error) {
      console.error('Error checking sleep-aware suggestion:', error);
      setLoading(false);
    }
  };

  const handleStartPractice = () => {
    if (suggestion?.speechId) {
      // If it's evening practice, record it for morning recall
      const hour = new Date().getHours();
      if (hour >= 19 && hour < 23) {
        localStorage.setItem('last-evening-practice', JSON.stringify({
          speechId: suggestion.speechId,
          timestamp: new Date().toISOString()
        }));
      }
      
      navigate(`/practice/${suggestion.speechId}`);
    }
  };

  const handleDismiss = () => {
    setSuggestion(null);
  };

  if (loading || !suggestion) {
    return null;
  }

  const getIcon = () => {
    switch (suggestion.icon) {
      case 'moon':
        return <Moon className="h-5 w-5 text-indigo-400" />;
      case 'sun':
        return <Sun className="h-5 w-5 text-amber-400" />;
      case 'brain':
        return <Brain className="h-5 w-5 text-purple-400" />;
      case 'clock':
        return <Clock className="h-5 w-5 text-blue-400" />;
      default:
        return <Sparkles className="h-5 w-5 text-primary" />;
    }
  };

  const getGradient = () => {
    switch (suggestion.icon) {
      case 'moon':
        return 'from-indigo-500/10 via-purple-500/5 to-transparent';
      case 'sun':
        return 'from-amber-500/10 via-orange-500/5 to-transparent';
      case 'brain':
        return 'from-purple-500/10 via-pink-500/5 to-transparent';
      case 'clock':
        return 'from-blue-500/10 via-cyan-500/5 to-transparent';
      default:
        return 'from-primary/10 to-transparent';
    }
  };

  return (
    <Card className={`border-0 bg-gradient-to-br ${getGradient()} shadow-apple animate-fade-in overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            suggestion.icon === 'moon' ? 'bg-indigo-500/20' :
            suggestion.icon === 'sun' ? 'bg-amber-500/20' :
            suggestion.icon === 'brain' ? 'bg-purple-500/20' :
            'bg-blue-500/20'
          }`}>
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-foreground">{suggestion.message}</h4>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {t('sleepScheduling.scienceBacked', 'Science-backed')}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {suggestion.subMessage}
            </p>
          </div>

          {/* Action */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleDismiss}
            >
              {t('common.later', 'Later')}
            </Button>
            <Button
              variant="apple"
              size="sm"
              onClick={handleStartPractice}
              className="gap-1"
            >
              {suggestion.type === 'morning_recall' 
                ? t('sleepScheduling.testRecall', 'Test Recall')
                : t('sleepScheduling.practiceNow', 'Practice Now')
              }
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SleepAwareScheduling;
