import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      speechId, 
      coveredKeywords,
      missedKeywords,
      durationSeconds
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    console.log('Analyzing freestyle session:', speechId);
    console.log('Covered keywords:', coveredKeywords?.length || 0);
    console.log('Missed keywords:', missedKeywords?.length || 0);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all keywords for this speech to calculate stats
    const { data: allKeywords, error: keywordsError } = await supabase
      .from('freestyle_keywords')
      .select('*')
      .eq('speech_id', speechId)
      .order('display_order');

    if (keywordsError) {
      console.error('Error fetching keywords:', keywordsError);
    }

    const totalKeywords = allKeywords?.length || (coveredKeywords?.length || 0) + (missedKeywords?.length || 0);
    const coveredCount = coveredKeywords?.length || 0;
    const missedCount = missedKeywords?.length || 0;
    const coveragePercent = totalKeywords > 0 ? Math.round((coveredCount / totalKeywords) * 100) : 0;

    // Calculate high-priority coverage
    const highPriorityKeywords = allKeywords?.filter((kw: any) => kw.importance === 'high') || [];
    const coveredHighPriority = highPriorityKeywords.filter((kw: any) => 
      coveredKeywords?.some((covered: string) => 
        covered.toLowerCase() === kw.keyword.toLowerCase()
      )
    ).length;
    const highPriorityPercent = highPriorityKeywords.length > 0 
      ? Math.round((coveredHighPriority / highPriorityKeywords.length) * 100) 
      : 100;

    // Generate feedback
    let feedback = {
      summary: 'Good freestyle presentation!',
      coverage: `You covered ${coveredCount} out of ${totalKeywords} keywords (${coveragePercent}%).`,
      highPriority: highPriorityKeywords.length > 0 
        ? `High priority: ${coveredHighPriority}/${highPriorityKeywords.length} covered`
        : 'All key points addressed!',
      advice: 'Keep practicing to improve keyword coverage.',
      nextStep: missedCount > 0 
        ? `Focus on these keywords next time: ${(missedKeywords || []).slice(0, 5).join(', ')}`
        : 'Great job covering all keywords! Try speaking faster next time.'
    };

    // Use OpenAI for enhanced feedback if available
    if (openAIApiKey && (coveredKeywords?.length > 0 || missedKeywords?.length > 0)) {
      try {
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a speech coach providing brief, encouraging feedback. Keep responses under 100 words total.'
              },
              {
                role: 'user',
                content: `Freestyle presentation results:
- Keywords covered: ${coveredCount}/${totalKeywords} (${coveragePercent}%)
- High priority covered: ${coveredHighPriority}/${highPriorityKeywords.length}
- Duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s
- Missed keywords: ${(missedKeywords || []).slice(0, 10).join(', ')}

Give brief encouraging feedback and one actionable tip.`
              }
            ],
            max_tokens: 200
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiText = aiData.choices[0]?.message?.content || '';
          feedback.summary = aiText;
        }
      } catch (aiError) {
        console.error('AI feedback error:', aiError);
      }
    }

    // Save the session
    const { error: sessionError } = await supabase
      .from('freestyle_sessions')
      .insert({
        speech_id: speechId,
        user_id: user.id,
        covered_segments: [], // Not used in keyword mode
        mentioned_cue_words: coveredKeywords || [],
        missed_cue_words: missedKeywords || [],
        improvisation_count: 0,
        pause_count: 0,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString()
      });

    if (sessionError) {
      console.error('Error saving session:', sessionError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        feedback,
        coverage: {
          totalKeywords,
          coveredKeywords: coveredCount,
          missedKeywords: missedCount,
          coveragePercent,
          highPriorityPercent
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing freestyle session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
