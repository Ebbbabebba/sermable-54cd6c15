import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcription, originalText, speechId, speechLanguage = 'en', feedbackLanguage = 'sv' } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    console.log('Starting speech analysis for speech ID:', speechId);
    console.log('Transcription received:', transcription.substring(0, 100));
    console.log('Speech language:', speechLanguage);
    console.log('Feedback language:', feedbackLanguage);

    const languageNames: Record<string, string> = {
      'en': 'English',
      'sv': 'Swedish', 
      'es': 'Spanish',
      'de': 'German',
      'fi': 'Finnish'
    };

    const spokenText = transcription;

    // Step 2: Use AI to analyze the speech with multi-language support
    console.log('Analyzing speech patterns...');
    const analysisPrompt = `You are an expert speech coach analyzing a practice session in detail.

The speech is in ${languageNames[speechLanguage] || 'English'}.
IMPORTANT: Provide ALL feedback in ${languageNames[feedbackLanguage] || 'Swedish'}.

Original text (in ${languageNames[speechLanguage]}): "${originalText}"
What was spoken (transcribed): "${spokenText}"

Provide a comprehensive analysis:

1. **Missing Words**: Words from the original text that were completely omitted
2. **Hesitation/Delayed Words**: Words where the speaker paused, repeated, or stumbled
3. **Filler Words**: Count instances of "uh", "um", "ehh", "ah", "like", "you know", etc.
4. **Tone Feedback**: Analyze the emotional tone. For parts of the text that should sound positive/happy, did the speaker convey that? For serious parts, was the tone appropriate?
5. **Pacing Issues**: Were there awkward pauses where the flow should have been smooth?
6. **Overall Accuracy**: Percentage of how well they matched the original text

IMPORTANT: All feedback text (toneFeedback, analysis) MUST be in ${languageNames[feedbackLanguage] || 'Swedish'}.

Respond in JSON format:
{
  "accuracy": <number 0-100>,
  "missedWords": ["word1", "word2"],
  "delayedWords": ["word3", "word4"],
  "fillerWords": {"uh": 2, "um": 3, "like": 1},
  "toneFeedback": "detailed feedback on tone in ${languageNames[feedbackLanguage]}",
  "analysis": "comprehensive feedback in ${languageNames[feedbackLanguage]}"
}`;

    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a helpful speech analysis assistant. Always respond with valid JSON. Provide feedback in ${languageNames[feedbackLanguage]}.` },
          { role: 'user', content: analysisPrompt }
        ],
      }),
    });

    if (!analysisResponse.ok) {
      const error = await analysisResponse.text();
      console.error('Analysis error:', error);
      throw new Error(`Analysis failed: ${error}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices[0].message.content;
    console.log('Raw analysis:', analysisText);

    // Parse JSON from the response
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (e) {
      console.error('Failed to parse analysis JSON:', e);
      analysis = {
        accuracy: 70,
        missedWords: [],
        delayedWords: [],
        fillerWords: {},
        toneFeedback: 'Unable to analyze tone',
        analysis: 'Unable to parse detailed analysis'
      };
    }

    // Step 3: Generate cue words in original speech language
    console.log('Generating cue words...');
    const cuePrompt = `Given this speech text and the words that need practice, create a simplified "cue word" version.

IMPORTANT: The cue text MUST be in ${languageNames[speechLanguage] || 'English'} (same language as the original speech).

Original text (in ${languageNames[speechLanguage]}): "${originalText}"
Words that need practice: ${[...analysis.missedWords, ...analysis.delayedWords].join(', ')}

Create a simplified version that:
1. Keeps all the problematic words
2. Removes words that were spoken well
3. Keeps minimal context words to maintain flow
4. Uses "..." to indicate removed sections
5. MUST be in ${languageNames[speechLanguage] || 'English'}

Example:
Original: "Today I want to talk about our future goals for the company"
Problematic words: "future", "goals"
Result: "Today... future goals... company"

Provide ONLY the cue text in ${languageNames[speechLanguage] || 'English'}, no explanations.`;

    const cueResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a helpful assistant that creates concise cue texts in ${languageNames[speechLanguage]}.` },
          { role: 'user', content: cuePrompt }
        ],
      }),
    });

    if (!cueResponse.ok) {
      const error = await cueResponse.text();
      console.error('Cue generation error:', error);
      throw new Error(`Cue generation failed: ${error}`);
    }

    const cueData = await cueResponse.json();
    const cueText = cueData.choices[0].message.content.trim();
    console.log('Generated cue text:', cueText);

    // Calculate next practice interval using spaced repetition
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('interval_days')
      .eq('speech_id', speechId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentInterval = scheduleData?.interval_days || 1;
    
    // Calculate next interval based on accuracy
    let nextInterval = 1;
    if (analysis.accuracy >= 90) {
      nextInterval = Math.min(currentInterval * 2, 30);
    } else if (analysis.accuracy >= 70) {
      nextInterval = Math.min(currentInterval + 2, 20);
    } else {
      nextInterval = 1;
    }

    // Update mastery level (weighted average)
    const { data: speechData } = await supabase
      .from('speeches')
      .select('mastery_level')
      .eq('id', speechId)
      .single();

    const currentMastery = speechData?.mastery_level || 0;
    const newMastery = (currentMastery * 0.7) + (analysis.accuracy * 0.3);

    await supabase
      .from('speeches')
      .update({ mastery_level: newMastery })
      .eq('id', speechId);

    // Create new schedule entry
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);

    await supabase.from('schedules').insert({
      speech_id: speechId,
      session_date: nextReviewDate.toISOString().split('T')[0],
      mastery_score: analysis.accuracy,
      interval_days: nextInterval,
      next_review_date: nextReviewDate.toISOString(),
      completed: false
    });

    return new Response(
      JSON.stringify({
        transcription: spokenText,
        accuracy: analysis.accuracy,
        missedWords: analysis.missedWords || [],
        delayedWords: analysis.delayedWords || [],
        fillerWords: analysis.fillerWords || {},
        toneFeedback: analysis.toneFeedback || '',
        analysis: analysis.analysis || 'Good practice session',
        cueText: cueText,
        nextPracticeInterval: nextInterval,
        nextPracticeDate: nextReviewDate.toISOString(),
        masteryLevel: Math.round(newMastery)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error in analyze-speech:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
