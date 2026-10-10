import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Brain, Lightbulb, Clock, ChevronRight } from "lucide-react";

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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const hour = new Date().getHours();
      const now = new Date();
      
      // Check for beats needing morning recall from the database
      if (hour >= 6 && hour < 12) {
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
      if (hour >= 6 && hour < 12) {
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
      
      navigate(`/practice/${suggestion.speechId}?recall=morning`);
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
        return <Moon className="s-g1 s-xv s-ug" />;
      case 'sun':
        return <Sun className="s-g1 s-xv s-ts" />;
      case 'brain':
        return <Brain className="s-g1 s-xv s-uz" />;
      case 'clock':
        return <Clock className="s-g1 s-xv s-tx" />;
      default:
        return <Lightbulb className="s-g1 s-xv s-uw" />;
    }
  };

  const getSurface = () => {
    switch (suggestion.icon) {
      case 'moon':
        return 's-4z';
      case 'sun':
        return 's-3u';
      case 'brain':
        return 's-5n';
      case 'clock':
        return 's-49';
      default:
        return 's-5e';
    }
  };

  return (
    <Card className={`s-6m ${getSurface()} s-2y s-mn`}>
      <CardContent className="s-mw">
        <div className="s-c5 s-id s-dq">
          {/* Icon */}
          <div className={`s-xf s-fn s-qo s-c5 s-ib s-ig s-r5 ${
            suggestion.icon === 'moon' ? 's-4z' :
            suggestion.icon === 'sun' ? 's-3u' :
            suggestion.icon === 'brain' ? 's-5n' :
            's-49'
          }`}>
            {getIcon()}
          </div>

          {/* Content */}
          <div className="s-c6 s-l8">
            <div className="s-c5 s-ib s-dn s-jw">
              <h4 className="s-d3 s-u9">{suggestion.message}</h4>
              <span className="s-vj s-op s-ox s-qe s-5e s-uw s-d0">
                {t('sleepScheduling.scienceBacked', 'Science-backed')}
              </span>
            </div>
            <p className="s-v9 s-ul s-ip">
              {suggestion.subMessage}
            </p>
          </div>

          {/* Action */}
          <div className="s-c5 s-ib s-dn s-r5">
            <Button
              variant="ghost"
              size="sm"
              className="s-ul s-hv"
              onClick={handleDismiss}
            >
              {t('common.later', 'Later')}
            </Button>
            <Button
              variant="apple"
              size="sm"
              onClick={handleStartPractice}
              className="s-dl"
            >
              {suggestion.type === 'morning_recall' 
                ? t('sleepScheduling.testRecall', 'Test Recall')
                : t('sleepScheduling.practiceNow', 'Practice Now')
              }
              <ChevronRight className="s-fz s-xt" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SleepAwareScheduling;
