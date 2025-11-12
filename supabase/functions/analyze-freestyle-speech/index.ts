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
    const { speechId, text } = await req.json();

    if (!speechId || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing speechId or text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use Lovable AI to analyze the speech and extract segments
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
            content: `You are an expert speech coach analyzing speeches for freestyle presentation mode. 
Your task is to break down a speech into logical segments and identify the most important cue words in each segment.

Guidelines:
- Divide the speech into 3-7 segments based on themes or ideas
- Each segment should be 2-5 sentences long
- Mark segments as "high", "medium", or "low" importance
- Extract 3-5 key cue words per segment (the most important words that capture the main idea)
- Cue words should be nouns, verbs, or key phrases that anchor the segment's meaning`
          },
          {
            role: 'user',
            content: `Analyze this speech and break it into segments with cue words:\n\n${text}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_speech_segments',
              description: 'Return the speech broken into segments with importance levels and cue words',
              parameters: {
                type: 'object',
                properties: {
                  segments: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        content: { type: 'string', description: 'The text content of this segment' },
                        importance_level: { 
                          type: 'string', 
                          enum: ['high', 'medium', 'low'],
                          description: 'How important this segment is to the overall speech'
                        },
                        cue_words: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'The 3-5 most important words/phrases in this segment'
                        }
                      },
                      required: ['content', 'importance_level', 'cue_words']
                    }
                  }
                },
                required: ['segments']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_speech_segments' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No tool call in AI response');
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);
    const segments = analysisResult.segments;

    // Delete existing segments for this speech
    await supabase
      .from('freestyle_segments')
      .delete()
      .eq('speech_id', speechId);

    // Insert new segments
    const segmentsToInsert = segments.map((segment: any, index: number) => ({
      speech_id: speechId,
      segment_order: index,
      content: segment.content,
      importance_level: segment.importance_level,
      cue_words: segment.cue_words
    }));

    const { error: insertError } = await supabase
      .from('freestyle_segments')
      .insert(segmentsToInsert);

    if (insertError) {
      throw insertError;
    }

    // Update speech mode to freestyle
    await supabase
      .from('speeches')
      .update({ presentation_mode: 'freestyle' })
      .eq('id', speechId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        segments: segmentsToInsert.length,
        message: 'Speech analyzed and segments created'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing freestyle speech:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
