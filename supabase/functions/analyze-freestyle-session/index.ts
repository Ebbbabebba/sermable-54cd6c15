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
      transcript, 
      durationSeconds,
      pauseCount,
      coveredSegments,
      mentionedCueWords
    } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

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

    // Get all segments for this speech
    const { data: segments, error: segmentsError } = await supabase
      .from('freestyle_segments')
      .select('*')
      .eq('speech_id', speechId)
      .order('segment_order');

    if (segmentsError) {
      throw segmentsError;
    }

    // Calculate missed cue words
    const allCueWords = segments.flatMap((s: any) => s.cue_words);
    const missedCueWords = allCueWords.filter((word: string) => 
      !mentionedCueWords.some((mentioned: string) => 
        mentioned.toLowerCase().includes(word.toLowerCase()) ||
        word.toLowerCase().includes(mentioned.toLowerCase())
      )
    );

    // Use AI to analyze improvisation and flow
    let feedback = {
      summary: 'Good freestyle presentation!',
      coverage: `You covered ${coveredSegments.length} out of ${segments.length} segments.`,
      missedWords: missedCueWords.length > 0 ? `Missed key words: ${missedCueWords.join(', ')}` : 'All key words mentioned!',
      advice: 'Keep practicing to improve flow and coverage.',
      nextStep: 'Try to cover all segments in your next practice.'
    };

    if (lovableApiKey) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a speech coach providing feedback on freestyle presentations. Be encouraging but constructive.'
              },
              {
                role: 'user',
                content: `Analyze this freestyle presentation:
- Total segments: ${segments.length}
- Covered segments: ${coveredSegments.length}
- Mentioned cue words: ${mentionedCueWords.length} out of ${allCueWords.length}
- Missed cue words: ${missedCueWords.join(', ')}
- Duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s
- Pauses: ${pauseCount}

Provide brief feedback focusing on coverage, flow, and areas for improvement.`
              }
            ]
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiText = aiData.choices[0]?.message?.content || '';
          
          feedback = {
            summary: aiText.slice(0, 200),
            coverage: `Covered ${coveredSegments.length}/${segments.length} segments`,
            missedWords: missedCueWords.length > 0 ? `Missed: ${missedCueWords.slice(0, 5).join(', ')}` : 'All key words covered!',
            advice: 'Focus on natural flow while hitting key points',
            nextStep: missedCueWords.length > 0 ? 'Practice the missed key words' : 'Try adding more personal anecdotes'
          };
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
        covered_segments: coveredSegments,
        mentioned_cue_words: mentionedCueWords,
        missed_cue_words: missedCueWords,
        improvisation_count: Math.max(0, transcript.split(' ').length - segments.reduce((acc: number, s: any) => acc + s.content.split(' ').length, 0)),
        pause_count: pauseCount,
        duration_seconds: durationSeconds,
        completed_at: new Date().toISOString()
      });

    if (sessionError) {
      throw sessionError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        feedback,
        coverage: {
          totalSegments: segments.length,
          coveredSegments: coveredSegments.length,
          coveragePercent: Math.round((coveredSegments.length / segments.length) * 100)
        },
        cueWords: {
          total: allCueWords.length,
          mentioned: mentionedCueWords.length,
          missed: missedCueWords
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
