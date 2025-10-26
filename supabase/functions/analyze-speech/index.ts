import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auth header present:', authHeader ? 'Yes' : 'No');

    // Create Supabase client with the user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { 
        headers: { 
          Authorization: authHeader 
        } 
      },
      auth: {
        persistSession: false
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      console.error('Invalid authentication:', userError?.message || 'No user found');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication: ' + (userError?.message || 'No user') }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const { audio, originalText, speechId, userTier, language } = await req.json();
    
    // Verify user owns the speech they're analyzing and get familiarity level
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('user_id, familiarity_level')
      .eq('id', speechId)
      .single();

    if (speechError || !speech || speech.user_id !== user.id) {
      console.error('Unauthorized access attempt to speech:', speechId, 'by user:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized access to speech' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const audioLanguage = language || 'en';
    console.log('Starting speech analysis for speech:', speechId, 'Language:', audioLanguage, 'User tier:', userTier, 'User ID:', user.id);

    // Step 1: Transcribe audio using OpenAI Whisper
    console.log('Transcribing audio with language:', audioLanguage);
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', audioLanguage);

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const error = await transcriptionResponse.text();
      console.error('Transcription error:', error);
      throw new Error(`Transcription failed: ${error}`);
    }

    const transcriptionData = await transcriptionResponse.json();
    const spokenText = transcriptionData.text;
    console.log('Transcription complete:', spokenText.substring(0, 100));

    // Step 2: Use AI to analyze the speech and identify issues
    console.log('Analyzing speech patterns...');
    
    const analysisPrompt = `Analyze this speech practice session and return ONLY valid JSON.

Original FULL speech text: "${originalText}"
Spoken text: "${spokenText}"
Language: ${audioLanguage}

CRITICAL INSTRUCTIONS:
- The user is practicing the FULL speech above
- They may only be shown simplified keywords as cues, but they must speak the ENTIRE speech
- Compare the spoken text against the FULL original speech text word by word
- Calculate accuracy based on how much of the FULL speech was spoken correctly
- Be LENIENT with pronunciation variations and similar-sounding words
- Consider words correct if they sound similar (e.g., "Eva" vs "Ebba", "shares" vs "chairs")
- PENALIZE WORD REPETITIONS: If the user repeats words unnecessarily (not in original text), reduce accuracy
- Only mark words as MISSED if they are completely absent from spoken text
- Only mark as DELAYED if there's an obvious long pause before the word
- Focus on the overall message delivery and flow of the COMPLETE speech

Compare them and identify:
1. accuracy: percentage match (0-100) based on how much of the FULL original speech was spoken correctly, MINUS penalties for word repetitions
2. missedWords: array of words COMPLETELY missing from spoken text (be strict - only clear omissions from the FULL speech)
3. delayedWords: array of words with obvious long pauses (be strict - only clear hesitations)
4. analysis: brief encouraging feedback about their delivery of the FULL speech

Return ONLY this JSON structure with no extra text:
{
  "accuracy": 85,
  "missedWords": ["example1"],
  "delayedWords": ["example2"],
  "analysis": "Good practice session"
}`;

    // Use GPT-5 Mini for faster, more accurate analysis
    const analysisModel = 'gpt-5-mini-2025-08-07';
    console.log('Using analysis model:', analysisModel);

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: analysisModel,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: 'You are a supportive speech analysis assistant. Be encouraging and lenient with word matching. Return ONLY valid JSON with no markdown formatting or explanations.' },
          { role: 'user', content: analysisPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis API error:', analysisResponse.status, errorText);
      throw new Error(`Analysis failed: ${errorText}`);
    }

    const analysisData = await analysisResponse.json();
    console.log('Full API response:', JSON.stringify(analysisData, null, 2));
    
    const analysisText = analysisData.choices[0]?.message?.content;
    console.log('Raw analysis response:', analysisText);

    if (!analysisText) {
      throw new Error('Empty response from AI');
    }

    // Parse JSON from the response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
      console.log('✅ Parsed analysis successfully:', JSON.stringify(analysis, null, 2));
      
      // Validate required fields
      if (typeof analysis.accuracy !== 'number') {
        analysis.accuracy = 70;
      }
      if (!Array.isArray(analysis.missedWords)) {
        analysis.missedWords = [];
      }
      if (!Array.isArray(analysis.delayedWords)) {
        analysis.delayedWords = [];
      }
      if (!analysis.analysis) {
        analysis.analysis = 'Practice session completed';
      }
    } catch (e) {
      console.error('❌ Failed to parse analysis JSON:', e);
      console.error('Response text was:', analysisText);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      throw new Error(`JSON parse error: ${errorMessage}`);
    }

    // Get schedule info to determine practice history
    const { data: schedule } = await supabase
      .from('schedules')
      .select('review_count, success_rate')
      .eq('speech_id', speechId)
      .single();

    const reviewCount = schedule?.review_count || 0;
    const successRate = schedule?.success_rate || 0;
    const familiarityLevel = speech.familiarity_level || 'beginner';
    
    console.log('Adaptive difficulty context:', { 
      familiarityLevel, 
      reviewCount, 
      successRate, 
      accuracy: analysis.accuracy 
    });

    // Step 3: Generate adaptive cue text based on familiarity and performance
    console.log('Generating adaptive cue text...');
    
    const problematicWords = [...analysis.missedWords, ...analysis.delayedWords];
    let cueText = originalText; // Default to full text
    
    // Determine if we should start removing words based on adaptive logic
    let shouldSimplify = false;
    let simplificationLevel = 0; // 0 = full text, 1 = minimal, 2 = moderate, 3 = aggressive
    
    if (familiarityLevel === 'beginner') {
      // Keep full text for first 5 practice sessions or until 80% success rate
      if (reviewCount >= 5 && successRate >= 80) {
        shouldSimplify = true;
        simplificationLevel = 1; // Start with minimal removal (only small connectors)
      }
      // Restore words if performance drops below 70%
      if (successRate < 70 || analysis.accuracy < 70) {
        shouldSimplify = false;
        console.log('Restoring full text due to low performance');
      }
    } else if (familiarityLevel === 'intermediate') {
      // Can start removing words after 2-3 sessions with 75%+ success
      if (reviewCount >= 2 && successRate >= 75) {
        shouldSimplify = true;
        simplificationLevel = 2; // Moderate removal
      }
      if (successRate < 65 || analysis.accuracy < 65) {
        shouldSimplify = false;
        console.log('Restoring full text due to low performance');
      }
    } else if (familiarityLevel === 'confident') {
      // Can start removing words immediately with good performance
      if (successRate >= 70 || reviewCount === 0) {
        shouldSimplify = true;
        simplificationLevel = reviewCount > 3 ? 3 : 2; // Progressive difficulty
      }
      if (successRate < 60 || analysis.accuracy < 60) {
        shouldSimplify = false;
        console.log('Restoring full text due to low performance');
      }
    }
    
    if (shouldSimplify && problematicWords.length > 0) {
      const cuePrompt = `Create a simplified cue text from this speech with adaptive difficulty.

Original: "${originalText}"
Problem words: ${problematicWords.join(', ')}
Simplification level: ${simplificationLevel}
Current performance: ${analysis.accuracy}%

ADAPTIVE RULES:
${simplificationLevel === 1 ? `
Level 1 (Minimal): Remove only small connector words (and, but, the, a, an, of, in, on, at, to, for)
- Keep 90% of content
- Focus on removing the smallest words that don't carry meaning
- Keep problem words and their full context
` : simplificationLevel === 2 ? `
Level 2 (Moderate): Remove small connectors + some common words
- Keep 70-80% of content
- Remove: and, but, the, a, an, of, in, on, at, to, for, that, this, with, from
- Keep problem words with 2-3 context words around them
- Use "..." between key sections
` : `
Level 3 (Aggressive): Show only key words and problem areas
- Keep 50-60% of content
- Remove all non-essential words except nouns, verbs, and problem words
- Keep problem words with 1-2 context words
- Use "..." liberally between sections
`}

Return ONLY the simplified cue text, nothing else.`;

      const cueResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'You create concise cue texts. Return only the cue text with no explanations.' },
            { role: 'user', content: cuePrompt }
          ],
          max_completion_tokens: 1000,
        }),
      });

      if (cueResponse.ok) {
        const cueData = await cueResponse.json();
        const generatedCue = cueData.choices[0]?.message?.content?.trim();
        if (generatedCue && generatedCue.length > 10) {
          cueText = generatedCue;
          console.log('✅ Generated adaptive cue text (level', simplificationLevel, '):', cueText.substring(0, 100));
        } else {
          console.log('⚠️ Cue generation returned short text, using original');
        }
      } else {
        console.error('Cue generation failed, using original text');
      }
    } else if (shouldSimplify) {
      // Even without problem words, can simplify if performance is good
      console.log('Good performance, generating simplified text without problem words');
      const simpleCuePrompt = `Simplify this speech by removing only small connector words.

Original: "${originalText}"
Simplification level: ${simplificationLevel}

Remove small words like: and, but, the, a, an, of, in, on, at, to, for
Keep all important content words and structure.

Return ONLY the simplified text.`;

      const simpleCueResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'You simplify texts by removing small words. Return only the simplified text.' },
            { role: 'user', content: simpleCuePrompt }
          ],
          max_completion_tokens: 1000,
        }),
      });

      if (simpleCueResponse.ok) {
        const simpleCueData = await simpleCueResponse.json();
        const generatedCue = simpleCueData.choices[0]?.message?.content?.trim();
        if (generatedCue && generatedCue.length > 10) {
          cueText = generatedCue;
          console.log('✅ Generated simplified cue text');
        }
      }
    } else {
      console.log('Keeping full text - building familiarity or performance needs improvement');
    }

    return new Response(
      JSON.stringify({
        transcription: spokenText,
        accuracy: analysis.accuracy,
        missedWords: analysis.missedWords || [],
        delayedWords: analysis.delayedWords || [],
        analysis: analysis.analysis || 'Good practice session',
        cueText: cueText,
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
