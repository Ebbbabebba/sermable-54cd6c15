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
    const { transcript, originalText, speechId, durationSeconds } = await req.json();
    
    console.log('Analyzing presentation:', { speechId, durationSeconds });

    // Calculate accuracy and detect issues
    const originalWords = originalText.toLowerCase().trim().split(/\s+/);
    const spokenWords = transcript.toLowerCase().trim().split(/\s+/);
    
    const originalSet = new Set(originalWords);
    const spokenSet = new Set(spokenWords);
    
    // Find missed words
    const missedWords = originalWords.filter((word: string) => !spokenSet.has(word));
    
    // Calculate accuracy
    const matchedWords = originalWords.filter((word: string) => spokenSet.has(word)).length;
    const accuracy = (matchedWords / originalWords.length) * 100;
    
    // Detect hesitations (filler words and repeated words)
    const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so'];
    let hesitations = 0;
    spokenWords.forEach((word: string) => {
      if (fillerWords.includes(word)) hesitations++;
    });
    
    // Generate AI feedback using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
    }

    let feedbackSummary = '';
    let feedbackAdvice = '';
    let feedbackNextStep = '';

    if (LOVABLE_API_KEY) {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a speech coach providing constructive feedback on presentations. Be encouraging but honest. Keep feedback concise and actionable.'
            },
            {
              role: 'user',
              content: `Analyze this presentation performance:
              
Accuracy: ${accuracy.toFixed(1)}%
Duration: ${durationSeconds}s
Hesitations: ${hesitations}
Missed Words: ${missedWords.length}

Original speech: ${originalText.substring(0, 500)}...
Actual transcript: ${transcript.substring(0, 500)}...

Provide:
1. A brief summary of the performance (2-3 sentences)
2. Specific advice for improvement (2-3 bullet points)
3. One clear next step to practice

Format your response as JSON:
{
  "summary": "...",
  "advice": "...",
  "nextStep": "..."
}`
            }
          ],
          temperature: 0.7,
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        const content = aiData.choices[0].message.content;
        
        try {
          const parsed = JSON.parse(content);
          feedbackSummary = parsed.summary || 'Good effort on your presentation!';
          feedbackAdvice = parsed.advice || 'Continue practicing to improve fluency.';
          feedbackNextStep = parsed.nextStep || 'Practice again focusing on the missed words.';
        } catch (e) {
          console.error('Failed to parse AI feedback:', e);
          feedbackSummary = 'Good effort on your presentation!';
          feedbackAdvice = 'Continue practicing to improve fluency and reduce hesitations.';
          feedbackNextStep = 'Practice the sections where you missed words.';
        }
      } else {
        console.error('AI gateway error:', await aiResponse.text());
      }
    } else {
      feedbackSummary = accuracy >= 90 ? 'Excellent presentation!' : accuracy >= 75 ? 'Good job! Some areas to improve.' : 'Keep practicing - you\'ll get there!';
      feedbackAdvice = missedWords.length > 0 ? `Focus on memorizing these words: ${missedWords.slice(0, 5).join(', ')}` : 'Great memory! Work on reducing filler words.';
      feedbackNextStep = 'Practice again, focusing on smooth delivery without pauses.';
    }

    return new Response(
      JSON.stringify({
        accuracy: parseFloat(accuracy.toFixed(2)),
        hesitations,
        missedWords,
        durationSeconds,
        feedbackSummary,
        feedbackAdvice,
        feedbackNextStep,
        transcript,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-presentation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
