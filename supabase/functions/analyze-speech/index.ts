import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { audio, originalText, speechId } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Starting speech analysis for speech:', speechId);

    // Step 1: Transcribe audio using Whisper (via OpenAI-compatible API)
    console.log('Transcribing audio...');
    const audioBuffer = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('model', 'whisper-1');

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
    const analysisPrompt = `You are a speech coach analyzing a practice session.

Original text: "${originalText}"
What was spoken: "${spokenText}"

Analyze the performance and identify:
1. Words that were missed completely
2. Words that were likely hesitated on (based on transcription patterns)
3. Overall accuracy percentage
4. Which words need more practice

Respond in JSON format:
{
  "accuracy": <number 0-100>,
  "missedWords": ["word1", "word2"],
  "delayedWords": ["word3", "word4"],
  "analysis": "brief feedback"
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
          { role: 'system', content: 'You are a helpful speech analysis assistant. Always respond with valid JSON.' },
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
        analysis: 'Unable to parse detailed analysis'
      };
    }

    // Step 3: Generate cue words (simplified version of text)
    console.log('Generating cue words...');
    const cuePrompt = `Given this speech text and the words that need practice, create a simplified "cue word" version.

Original text: "${originalText}"
Words that need practice: ${[...analysis.missedWords, ...analysis.delayedWords].join(', ')}

Create a simplified version that:
1. Keeps all the problematic words
2. Removes words that were spoken well
3. Keeps minimal context words to maintain flow
4. Uses "..." to indicate removed sections

Example:
Original: "Today I want to talk about our future goals for the company"
Problematic words: "future", "goals"
Result: "Today... future goals... company"

Provide ONLY the cue text, no explanations.`;

    const cueResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that creates concise cue texts.' },
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
