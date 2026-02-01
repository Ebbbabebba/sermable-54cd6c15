import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordMasteryStats {
  word: string;
  totalCorrect: number;
  totalHesitated: number;
  totalMissed: number;
  masteryLevel: number;
  lastSeenAt: string;
  trend: 'improving' | 'declining' | 'stable';
  recentSessions: {
    date: string;
    status: string;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { speechId, limit = 20 } = await req.json().catch(() => ({}));

    // Get word mastery data for the user
    let query = supabase
      .from('user_word_mastery')
      .select('*')
      .eq('user_id', user.id)
      .order('mastery_level', { ascending: true })
      .limit(limit);

    const { data: masteryData, error: masteryError } = await query;

    if (masteryError) {
      console.error('Error fetching mastery data:', masteryError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch word mastery' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get recent word performance for trend analysis
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: recentPerformance } = await supabase
      .from('presentation_word_performance')
      .select(`
        word,
        status,
        created_at,
        presentation_sessions!inner(speech_id)
      `)
      .gte('created_at', oneWeekAgo.toISOString())
      .in('word', (masteryData || []).map(w => w.word));

    // Calculate trends for each word
    const wordStats: WordMasteryStats[] = (masteryData || []).map(word => {
      const recentForWord = (recentPerformance || [])
        .filter(p => p.word.toLowerCase() === word.word.toLowerCase())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate trend based on recent sessions
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (recentForWord.length >= 2) {
        const recentHalf = recentForWord.slice(0, Math.ceil(recentForWord.length / 2));
        const olderHalf = recentForWord.slice(Math.ceil(recentForWord.length / 2));
        
        const recentCorrectRate = recentHalf.filter(p => p.status === 'correct').length / recentHalf.length;
        const olderCorrectRate = olderHalf.filter(p => p.status === 'correct').length / olderHalf.length;
        
        if (recentCorrectRate > olderCorrectRate + 0.1) {
          trend = 'improving';
        } else if (recentCorrectRate < olderCorrectRate - 0.1) {
          trend = 'declining';
        }
      }

      return {
        word: word.word,
        totalCorrect: word.total_correct || 0,
        totalHesitated: word.total_hesitated || 0,
        totalMissed: word.total_missed || 0,
        masteryLevel: word.mastery_level || 0,
        lastSeenAt: word.last_seen_at,
        trend,
        recentSessions: recentForWord.slice(0, 5).map(p => ({
          date: p.created_at,
          status: p.status,
        })),
      };
    });

    // Categorize words
    const strugglingWords = wordStats.filter(w => w.masteryLevel < 50);
    const improvingWords = wordStats.filter(w => w.trend === 'improving');
    const masteredWords = wordStats.filter(w => w.masteryLevel >= 80);

    // Get session comparison data if speechId provided
    let sessionComparison = null;
    if (speechId) {
      const { data: sessions } = await supabase
        .from('presentation_sessions')
        .select('id, accuracy, hesitations, duration_seconds, created_at, pace_consistency')
        .eq('speech_id', speechId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessions && sessions.length >= 2) {
        const latest = sessions[0];
        const previous = sessions[1];
        const best = sessions.reduce((max, s) => s.accuracy > max.accuracy ? s : max, sessions[0]);

        sessionComparison = {
          current: {
            accuracy: latest.accuracy,
            hesitations: latest.hesitations,
            paceConsistency: latest.pace_consistency,
            date: latest.created_at,
          },
          previous: {
            accuracy: previous.accuracy,
            hesitations: previous.hesitations,
            paceConsistency: previous.pace_consistency,
            date: previous.created_at,
          },
          personalBest: {
            accuracy: best.accuracy,
            date: best.created_at,
          },
          improvement: {
            accuracy: latest.accuracy - previous.accuracy,
            hesitations: previous.hesitations - latest.hesitations,
          },
          sessionHistory: sessions.map(s => ({
            date: s.created_at,
            accuracy: s.accuracy,
            hesitations: s.hesitations,
          })),
        };
      }
    }

    return new Response(
      JSON.stringify({
        words: wordStats,
        summary: {
          totalWordsTracked: wordStats.length,
          strugglingCount: strugglingWords.length,
          improvingCount: improvingWords.length,
          masteredCount: masteredWords.length,
        },
        strugglingWords: strugglingWords.slice(0, 10),
        improvingWords: improvingWords.slice(0, 5),
        sessionComparison,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-word-mastery:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
