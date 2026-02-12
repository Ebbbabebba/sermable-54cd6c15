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
      const now = new Date();
      
      // Check for beats needing morning recall from the database
      if (hour >= 6 && hour < 10) {
        const { data: morningRecallBeats } = await supabase
          .from('practice_beats')
          .select(`
            id,
            beat_order,
            recall_morning_at,
            last_recall_at,
            speech_id,
            speeches!inner(id, title)
          `)
          .eq('is_mastered', true)
          .not('recall_morning_at', 'is', null)
          .lte('recall_morning_at', now.toISOString());
        
        // Filter to those not yet recalled after morning time
        const pendingMorningRecalls = (morningRecallBeats || []).filter((beat: any) => {
          const morningTime = new Date(beat.recall_morning_at);
          if (!beat.last_recall_at) return true;
          return new Date(beat.last_recall_at) < morningTime;
        });
        
        if (pendingMorningRecalls.length > 0) {
          const firstBeat = pendingMorningRecalls[0] as any;
          const speechTitle = firstBeat.speeches?.title || 'your speech';
          const speechId = firstBeat.speech_id;
          
          setSuggestion({
            type: 'morning_recall',
            speechId: speechId,
            speechTitle: speechTitle,
            message: t('sleepScheduling.morningRecall', 'Morning Memory Test'),
            subMessage: t('sleepScheduling.morningRecallDesc', 'Your brain consolidated memories overnight. Test your recall of "{{title}}" now for maximum retention!', { title: speechTitle }),
            icon: 'sun'
          });
          setLoading(false);
          return;
        }
      }
      
      // Fallback: check localStorage for evening practice (legacy support)
      if (hour >= 6 && hour < 10) {
        const lastEveningPractice = localStorage.getItem('last-evening-practice');
        const lastEveningData = lastEveningPractice ? JSON.parse(lastEveningPractice) : null;
        
        if (lastEveningData) {
          const lastPracticeDate = new Date(lastEveningData.timestamp);
          const hoursSinceEvening = (now.getTime() - lastPracticeDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceEvening < 14 && hoursSinceEvening > 4) {
            const { data: speeches } = await supabase
              .from("speeches")
              .select("id, title")
              .eq('id', lastEveningData.speechId)
              .single();
            
            if (speeches) {
              setSuggestion({
                type: 'morning_recall',
                speechId: speeches.id,
                speechTitle: speeches.title,
                message: t('sleepScheduling.morningRecall', 'Morning Memory Test'),
                subMessage: t('sleepScheduling.morningRecallDesc', 'Your brain consolidated memories overnight. Test your recall of "{{title}}" now for maximum retention!', { title: speeches.title }),
                icon: 'sun'
              });
              setLoading(false);
              return;
            }
          }
        }
      }

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
