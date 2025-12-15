import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WordPerformance {
  word: string;
  index: number;
  status: "correct" | "hesitated" | "missed" | "skipped";
  timeToSpeak?: number;
  wasPrompted: boolean;
  wrongWordsSaid?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, originalText, speechId, durationSeconds, wordPerformance } = await req.json();
    
    console.log('Analyzing presentation:', { speechId, durationSeconds, hasWordPerformance: !!wordPerformance });

    const originalWords = originalText.toLowerCase().trim().split(/\s+/);
    let accuracy: number;
    let hesitations: number;
    let missedWords: string[] = [];
    let skippedWords: string[] = [];
    let promptedWords: string[] = [];
    let wrongAttempts: { word: string; attempts: string[] }[] = [];
    
    // Use detailed word performance if available (from strict mode)
    if (wordPerformance && wordPerformance.length > 0) {
      console.log('Using detailed word performance data:', wordPerformance.length, 'words');
      
      const correctCount = wordPerformance.filter((w: WordPerformance) => w.status === 'correct').length;
      const hesitatedCount = wordPerformance.filter((w: WordPerformance) => w.status === 'hesitated').length;
      const missedCount = wordPerformance.filter((w: WordPerformance) => w.status === 'missed').length;
      const skippedCount = wordPerformance.filter((w: WordPerformance) => w.status === 'skipped').length;
      
      // Accuracy: correct = 100%, hesitated = 50%, missed/skipped = 0%
      const totalWords = wordPerformance.length;
      accuracy = ((correctCount * 1.0 + hesitatedCount * 0.5) / totalWords) * 100;
      hesitations = hesitatedCount;
      
      missedWords = wordPerformance
        .filter((w: WordPerformance) => w.status === 'missed')
        .map((w: WordPerformance) => w.word);
      
      skippedWords = wordPerformance
        .filter((w: WordPerformance) => w.status === 'skipped')
        .map((w: WordPerformance) => w.word);
      
      promptedWords = wordPerformance
        .filter((w: WordPerformance) => w.wasPrompted)
        .map((w: WordPerformance) => w.word);
      
      wrongAttempts = wordPerformance
        .filter((w: WordPerformance) => w.wrongWordsSaid && w.wrongWordsSaid.length > 0)
        .map((w: WordPerformance) => ({ word: w.word, attempts: w.wrongWordsSaid! }));
      
      console.log('Performance stats:', { 
        correct: correctCount, 
        hesitated: hesitatedCount, 
        missed: missedCount, 
        skipped: skippedCount,
        prompted: promptedWords.length,
        wrongAttempts: wrongAttempts.length
      });
      
    } else if (transcript) {
      // Fallback to transcript-based analysis
      console.log('Using transcript-based analysis');
      
      const spokenWords = transcript.toLowerCase().trim().split(/\s+/);
      const originalSet = new Set(originalWords);
      const spokenSet = new Set(spokenWords);
      
      missedWords = originalWords.filter((word: string) => !spokenSet.has(word));
      const matchedWords = originalWords.filter((word: string) => spokenSet.has(word)).length;
      accuracy = (matchedWords / originalWords.length) * 100;
      
      // Detect hesitations (filler words)
      const fillerWords = ['um', 'uh', 'like', 'you know', 'actually', 'basically', 'so', 'eh', 'ah'];
      hesitations = 0;
      spokenWords.forEach((word: string) => {
        if (fillerWords.includes(word)) hesitations++;
      });
    } else {
      // No data available
      accuracy = 0;
      hesitations = 0;
      missedWords = originalWords;
    }

    // Generate AI feedback using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    let feedbackSummary = '';
    let feedbackAdvice = '';
    let feedbackNextStep = '';

    if (LOVABLE_API_KEY) {
      // Build detailed performance context for AI
      let performanceContext = `
Accuracy: ${accuracy.toFixed(1)}%
Duration: ${durationSeconds}s
Hesitations/Struggles: ${hesitations}
Missed Words: ${missedWords.length > 0 ? missedWords.slice(0, 10).join(', ') : 'None'}
Skipped Words: ${skippedWords.length > 0 ? skippedWords.slice(0, 10).join(', ') : 'None'}
Words where prompt was needed: ${promptedWords.length > 0 ? promptedWords.slice(0, 10).join(', ') : 'None'}`;

      if (wrongAttempts.length > 0) {
        performanceContext += `\n\nWrong word attempts (user said something different):`;
        wrongAttempts.slice(0, 5).forEach(w => {
          performanceContext += `\n- Expected "${w.word}", user said: ${w.attempts.join(', ')}`;
        });
      }

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
              content: `You are a speech coach providing constructive feedback on presentations. Be encouraging but honest and specific. 

IMPORTANT: 
- If accuracy is 100%, celebrate it!
- If accuracy is below 100%, be specific about WHY (missed words, skipped sections, needed prompts)
- Mention specific words the user struggled with
- If they said wrong words, explain what happened
- Keep feedback concise and actionable`
            },
            {
              role: 'user',
              content: `Analyze this strict presentation mode performance:
${performanceContext}

Original speech excerpt: ${originalText.substring(0, 300)}...

Provide specific, actionable feedback:
1. A brief summary of the performance (2-3 sentences, be specific about what went well and what didn't)
2. Specific advice for improvement (2-3 bullet points, mention actual words if there were issues)
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
          // Extract JSON from response (handle markdown code blocks)
          let jsonContent = content;
          const jsonMatch = content.match(/```json?\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            jsonContent = jsonMatch[1];
          }
          
          const parsed = JSON.parse(jsonContent);
          feedbackSummary = parsed.summary || 'Good effort on your presentation!';
          feedbackAdvice = parsed.advice || 'Continue practicing to improve fluency.';
          feedbackNextStep = parsed.nextStep || 'Practice again focusing on the missed words.';
        } catch (e) {
          console.error('Failed to parse AI feedback:', e, 'Raw content:', content);
          feedbackSummary = accuracy >= 90 ? 'Excellent performance!' : 'Good effort, keep practicing!';
          feedbackAdvice = 'Continue practicing to improve fluency and reduce hesitations.';
          feedbackNextStep = 'Practice the sections where you needed prompts.';
        }
      } else {
        console.error('AI gateway error:', await aiResponse.text());
      }
    }
    
    // Fallback feedback if AI not available
    if (!feedbackSummary) {
      if (accuracy >= 95) {
        feedbackSummary = 'Outstanding! You delivered the speech almost perfectly!';
      } else if (accuracy >= 85) {
        feedbackSummary = 'Great job! You remembered most of the speech with only minor struggles.';
      } else if (accuracy >= 70) {
        feedbackSummary = 'Good effort! Some sections need more practice.';
      } else {
        feedbackSummary = 'Keep practicing! Focus on the sections where you needed help.';
      }
      
      if (promptedWords.length > 0) {
        feedbackAdvice = `Focus on memorizing: ${promptedWords.slice(0, 5).join(', ')}`;
      } else if (missedWords.length > 0) {
        feedbackAdvice = `Review these words: ${missedWords.slice(0, 5).join(', ')}`;
      } else {
        feedbackAdvice = 'Work on maintaining a steady pace without pauses.';
      }
      
      feedbackNextStep = 'Practice again, aiming for a smooth delivery without pauses.';
    }

    return new Response(
      JSON.stringify({
        accuracy: parseFloat(accuracy.toFixed(2)),
        hesitations,
        missedWords: [...missedWords, ...skippedWords],
        promptedWords,
        wrongAttempts,
        durationSeconds,
        feedbackSummary,
        feedbackAdvice,
        feedbackNextStep,
        transcript: transcript || '',
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
