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
    const { audio, originalText, speechId, userTier } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('Starting speech analysis for speech:', speechId, 'User tier:', userTier);

    // Step 1: Transcribe audio using OpenAI Whisper
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
    
    const analysisPrompt = `Analyze this speech practice session and return ONLY valid JSON.

Original text: "${originalText}"
Spoken text: "${spokenText}"

Instructions:
- Be LENIENT with word matching - similar pronunciations should count as correct
- Consider words correct if they sound similar (e.g., "Eva" vs "Ebba", "shares" vs "chairs")
- Only mark words as MISSED if they are completely absent
- Only mark as DELAYED if there's a long pause before the word
- Focus on the overall message delivery, not perfect word-for-word matching

Compare them and identify:
1. accuracy: percentage match (0-100) - be generous with partial matches
2. missedWords: array of words COMPLETELY missing from spoken text (be strict - only clear omissions)
3. delayedWords: array of words with obvious long pauses (be strict - only clear hesitations)
4. analysis: brief encouraging feedback

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

    // Step 3: Generate cue words (simplified version of text)
    console.log('Generating cue words...');
    
    const problematicWords = [...analysis.missedWords, ...analysis.delayedWords];
    let cueText = originalText; // Default to full text if cue generation fails
    
    if (problematicWords.length > 0) {
      const cuePrompt = `Create a simplified cue text from this speech focusing on problem words.

Original: "${originalText}"
Problem words: ${problematicWords.join(', ')}

Rules:
1. Keep ALL problem words
2. Keep 1-2 context words around each problem word
3. Use "..." between sections
4. Maximum 50% of original length

Return ONLY the cue text, nothing else.`;

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
          console.log('✅ Generated cue text:', cueText);
        } else {
          console.log('⚠️ Cue generation returned short text, using original');
        }
      } else {
        console.error('Cue generation failed, using original text');
      }
    } else {
      console.log('No problematic words, keeping original text');
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
