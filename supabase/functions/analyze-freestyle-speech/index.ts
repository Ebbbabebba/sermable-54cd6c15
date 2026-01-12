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
    // Authentication check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    // Create client with user's auth context for ownership verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    const { speechId, text } = await req.json();

    if (!speechId || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing speechId or text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify speech ownership
    const { data: speechOwnership, error: ownershipError } = await supabaseAuth
      .from('speeches')
      .select('user_id')
      .eq('id', speechId)
      .single();

    if (ownershipError || !speechOwnership || speechOwnership.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Analyzing speech for freestyle mode:', speechId);

    // Use OpenAI to analyze the speech and extract topics with keywords
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
            content: `You are an expert speech coach helping speakers practice freestyle presentations.
Your task is to break down a speech into clear, ordered topics with categorized keywords.

Guidelines:
- Divide the speech into 3-6 main topics/sections in the order they appear
- For each topic, provide:
  1. A clear topic name (2-4 words max)
  2. A one-sentence hint the speaker can glance at if stuck
  3. The original text for this section (for panic button)
  4. 4-8 keywords categorized by type:
     - "number": statistics, percentages, amounts, quantities
     - "date": dates, deadlines, time periods, quarters
     - "concept": key ideas, themes, abstract concepts
     - "name": proper nouns, project names, people, companies
     - "action": important verbs, calls to action
  5. Mark each keyword as high/medium/low importance

Focus on extracting the most memorable and essential words that anchor each topic.`
          },
          {
            role: 'user',
            content: `Analyze this speech and extract topics with categorized keywords:\n\n${text}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_speech_topics',
              description: 'Return the speech broken into ordered topics with categorized keywords',
              parameters: {
                type: 'object',
                properties: {
                  topics: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        topic_name: { type: 'string', description: 'Short topic name (2-4 words)' },
                        summary_hint: { type: 'string', description: 'One-sentence hint for the speaker' },
                        original_text: { type: 'string', description: 'The original text for this section' },
                        keywords: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              word: { type: 'string', description: 'The keyword or short phrase' },
                              keyword_type: { 
                                type: 'string', 
                                enum: ['number', 'date', 'concept', 'name', 'action'],
                                description: 'The type of keyword'
                              },
                              importance: { 
                                type: 'string', 
                                enum: ['high', 'medium', 'low'],
                                description: 'How important this keyword is'
                              }
                            },
                            required: ['word', 'keyword_type', 'importance']
                          }
                        }
                      },
                      required: ['topic_name', 'summary_hint', 'original_text', 'keywords']
                    }
                  }
                },
                required: ['topics']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_speech_topics' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
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
      console.error('No tool call in AI response:', aiData);
      throw new Error('No tool call in AI response');
    }

    const analysisResult = JSON.parse(toolCall.function.arguments);
    const topics = analysisResult.topics;

    console.log('Extracted topics:', topics.length);

    // Delete existing topics and keywords for this speech
    await supabase
      .from('freestyle_keywords')
      .delete()
      .eq('speech_id', speechId);
    
    await supabase
      .from('freestyle_topics')
      .delete()
      .eq('speech_id', speechId);

    // Insert topics and keywords
    let keywordOrder = 0;
    for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
      const topic = topics[topicIndex];
      
      // Insert topic
      const { data: topicData, error: topicError } = await supabase
        .from('freestyle_topics')
        .insert({
          speech_id: speechId,
          topic_order: topicIndex,
          topic_name: topic.topic_name,
          summary_hint: topic.summary_hint,
          original_text: topic.original_text
        })
        .select('id')
        .single();

      if (topicError) {
        console.error('Error inserting topic:', topicError);
        throw topicError;
      }

      // Insert keywords for this topic
      const keywordsToInsert = topic.keywords.map((keyword: any) => ({
        speech_id: speechId,
        topic_id: topicData.id,
        topic: topic.topic_name,
        keyword: keyword.word,
        keyword_type: keyword.keyword_type,
        importance: keyword.importance,
        display_order: keywordOrder++
      }));

      const { error: keywordsError } = await supabase
        .from('freestyle_keywords')
        .insert(keywordsToInsert);

      if (keywordsError) {
        console.error('Error inserting keywords:', keywordsError);
        throw keywordsError;
      }
    }

    // Update speech mode to freestyle
    await supabase
      .from('speeches')
      .update({ presentation_mode: 'freestyle' })
      .eq('id', speechId);

    console.log('Successfully analyzed speech with', topics.length, 'topics');

    return new Response(
      JSON.stringify({ 
        success: true, 
        topics: topics.length,
        message: 'Speech analyzed with topics and keywords'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing freestyle speech:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'PROCESSING_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
