import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

interface FluencyTimelineEntry {
  wordIndex: number;
  word: string;
  status: string;
  timeMs: number;
  timestamp: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, originalText, speechId, durationSeconds, wordPerformance, mode = 'strict' } = await req.json();
    
    console.log('Analyzing presentation:', { speechId, durationSeconds, hasWordPerformance: !!wordPerformance, mode });

    const originalWords = originalText.toLowerCase().trim().split(/\s+/);
    let accuracy: number;
    let hesitations: number;
    let missedWords: string[] = [];
    let skippedWords: string[] = [];
    let promptedWords: string[] = [];
    let wrongAttempts: { word: string; attempts: string[] }[] = [];
    let fluencyTimeline: FluencyTimelineEntry[] = [];
    let avgTimePerWordMs: number | null = null;
    let longestPauseMs: number | null = null;
    let paceConsistency: number | null = null;
    
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
      
      // Build fluency timeline
      fluencyTimeline = wordPerformance.map((w: WordPerformance, idx: number) => ({
        wordIndex: w.index ?? idx,
        word: w.word,
        status: w.status,
        timeMs: w.timeToSpeak ?? 0,
        timestamp: idx * (w.timeToSpeak ?? 500), // Approximate timestamp
      }));
      
      // Calculate pace metrics
      const timings = wordPerformance
        .filter((w: WordPerformance) => w.timeToSpeak && w.timeToSpeak > 0)
        .map((w: WordPerformance) => w.timeToSpeak!);
      
      if (timings.length > 0) {
        avgTimePerWordMs = Math.round(timings.reduce((a: number, b: number) => a + b, 0) / timings.length);
        longestPauseMs = Math.max(...timings);
        
        // Calculate pace consistency (0-100, higher = more consistent)
        const mean = avgTimePerWordMs;
        const variance = timings.reduce((sum: number, t: number) => sum + Math.pow(t - mean, 2), 0) / timings.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = stdDev / mean;
        paceConsistency = Math.max(0, Math.min(100, Math.round((1 - coefficientOfVariation) * 100)));
      }
      
      console.log('Performance stats:', { 
        correct: correctCount, 
        hesitated: hesitatedCount, 
        missed: missedCount, 
        skipped: skippedCount,
        prompted: promptedWords.length,
        wrongAttempts: wrongAttempts.length,
        avgTimePerWordMs,
        longestPauseMs,
        paceConsistency
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
Pace Consistency: ${paceConsistency !== null ? paceConsistency + '%' : 'N/A'}
Average time per word: ${avgTimePerWordMs !== null ? avgTimePerWordMs + 'ms' : 'N/A'}
Longest pause: ${longestPauseMs !== null ? longestPauseMs + 'ms' : 'N/A'}
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
- Consider their pacing - if pace consistency is low, mention it
- Keep feedback concise and actionable
- PROPER NOUNS & NAMES: Names of people, places, organizations (e.g. "Ebba Hallert Djurberg") are often misinterpreted by speech recognition. Treat them with maximum leniency - accept any phonetically similar variation and do NOT penalize for name differences. Just gently correct the name if needed.`
            },
            {
              role: 'user',
              content: `Analyze this ${mode} presentation mode performance:
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

    // Save detailed word performance to database if available
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user_id from speech
    const { data: speechData } = await supabase
      .from('speeches')
      .select('user_id')
      .eq('id', speechId)
      .single();

    const userId = speechData?.user_id;

    // Create the session with enhanced data
    const { data: sessionData, error: sessionError } = await supabase
      .from('presentation_sessions')
      .insert({
        speech_id: speechId,
        user_id: userId,
        accuracy: parseFloat(accuracy.toFixed(2)),
        hesitations,
        duration_seconds: durationSeconds,
        transcript: transcript || '',
        missed_words: [...missedWords, ...skippedWords],
        feedback_summary: feedbackSummary,
        feedback_advice: feedbackAdvice,
        feedback_next_step: feedbackNextStep,
        mode,
        fluency_timeline: fluencyTimeline,
        avg_time_per_word_ms: avgTimePerWordMs,
        longest_pause_ms: longestPauseMs,
        pace_consistency: paceConsistency,
        word_performance_json: wordPerformance || [],
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error saving session:', sessionError);
    } else if (sessionData && wordPerformance && wordPerformance.length > 0) {
      // Save individual word performance records
      const wordRecords = wordPerformance.map((w: WordPerformance, idx: number) => ({
        session_id: sessionData.id,
        speech_id: speechId,
        word: w.word,
        word_index: w.index ?? idx,
        status: w.status,
        time_to_speak_ms: w.timeToSpeak ?? null,
        was_prompted: w.wasPrompted,
        wrong_attempts: w.wrongWordsSaid || [],
      }));

      const { error: wordError } = await supabase
        .from('presentation_word_performance')
        .insert(wordRecords);

      if (wordError) {
        console.error('Error saving word performance:', wordError);
      } else {
        console.log('Saved', wordRecords.length, 'word performance records');
      }

      // Update user_word_mastery for cross-session tracking
      if (userId) {
        for (const w of wordPerformance) {
          const { data: existing } = await supabase
            .from('user_word_mastery')
            .select('*')
            .eq('user_id', userId)
            .eq('word', w.word.toLowerCase())
            .single();

          if (existing) {
            await supabase
              .from('user_word_mastery')
              .update({
                total_correct: existing.total_correct + (w.status === 'correct' ? 1 : 0),
                total_hesitated: existing.total_hesitated + (w.status === 'hesitated' ? 1 : 0),
                total_missed: existing.total_missed + (w.status === 'missed' || w.status === 'skipped' ? 1 : 0),
                mastery_level: calculateMasteryLevel(
                  existing.total_correct + (w.status === 'correct' ? 1 : 0),
                  existing.total_hesitated + (w.status === 'hesitated' ? 1 : 0),
                  existing.total_missed + (w.status === 'missed' || w.status === 'skipped' ? 1 : 0)
                ),
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('user_word_mastery')
              .insert({
                user_id: userId,
                word: w.word.toLowerCase(),
                total_correct: w.status === 'correct' ? 1 : 0,
                total_hesitated: w.status === 'hesitated' ? 1 : 0,
                total_missed: w.status === 'missed' || w.status === 'skipped' ? 1 : 0,
                mastery_level: w.status === 'correct' ? 100 : w.status === 'hesitated' ? 50 : 0,
              });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        sessionId: sessionData?.id,
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
        fluencyTimeline,
        avgTimePerWordMs,
        longestPauseMs,
        paceConsistency,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-presentation:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'PROCESSING_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateMasteryLevel(correct: number, hesitated: number, missed: number): number {
  const total = correct + hesitated + missed;
  if (total === 0) return 0;
  // Weighted: correct = 100%, hesitated = 50%, missed = 0%
  return Math.round(((correct * 100) + (hesitated * 50)) / total);
}
