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
    const { 
      transcription, 
      originalText, 
      cueText,
      speechId, 
      speechLanguage = 'en', 
      feedbackLanguage = 'sv' 
    } = await req.json();
    
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
    console.log('Analyzing against FULL ORIGINAL speech');
    if (cueText && cueText !== originalText) {
      console.log('User is practicing with cue words as memory prompts');
    }

    const languageNames: Record<string, string> = {
      'en': 'English',
      'sv': 'Swedish', 
      'es': 'Spanish',
      'de': 'German',
      'fi': 'Finnish'
    };

    const spokenText = transcription;

    // CRITICAL: Analyze against the FULL ORIGINAL speech
    // Even if user is shown cue words, we measure full speech recall
    console.log('Analyzing speech patterns against full original text...');
    
    const practiceMode = cueText && cueText !== originalText ? 'cue_words' : 'full_text';
    
    const analysisPrompt = `You are an expert speech coach analyzing a practice session in detail.

The speech is in ${languageNames[speechLanguage] || 'English'}.
IMPORTANT: Provide ALL feedback in ${languageNames[feedbackLanguage] || 'Swedish'}.

${practiceMode === 'cue_words' ? `
CRITICAL CONTEXT: The user is practicing with CUE WORDS as memory prompts.
- The user was shown simplified cue words (not the full text)
- They attempted to recall and speak the ENTIRE SPEECH from memory
- Your analysis MUST compare what they said to the FULL ORIGINAL SPEECH
- This tests true memorization, not just reading cue words
` : ''}

FULL ORIGINAL TEXT (what should be spoken): "${originalText}"
${practiceMode === 'cue_words' ? `CUE WORDS shown to user: "${cueText}"` : ''}
What was actually spoken (transcribed): "${spokenText}"

Provide a comprehensive analysis comparing spoken content sentence-by-sentence to the FULL ORIGINAL SPEECH:

1. **Overall Accuracy**: Percentage of the FULL ORIGINAL SPEECH that was correctly recalled (0-100)
   - CRITICAL CALCULATION: (correctly spoken words / total words in original speech) × 100
   - Count ONLY words that appear in the original speech and were spoken correctly
   - If user only spoke cue words, this will be a LOW percentage
   - Every missing word from the original reduces the accuracy
   
2. **Missing Words/Sections**: 
   - Words or entire sections from the FULL ORIGINAL that were completely omitted
   - List specific words/phrases that should have been said but weren't
   - Include sections between cue words that were skipped
   
3. **Hesitation/Delayed Words**: 
   - Words where the speaker paused, stumbled, or showed uncertainty
   - Words spoken out of order or with long pauses before them
   
4. **Filler Words**: Count instances of "uh", "um", "ehh", "ah", "like", "you know", etc.

5. **Sequence Errors**: 
   - Did the speaker follow the correct order of the original speech?
   - Were any sections jumbled or reversed?

6. **Completion Status**:
   - Did the user speak the ENTIRE speech or only parts of it?
   - What percentage of the full speech was attempted?
   - How many words from the original were actually spoken?

7. **Tone Feedback**: Was the emotional tone appropriate for the content?

8. **Pacing Issues**: Were there awkward pauses where flow should be smooth?

${practiceMode === 'cue_words' ? `
CRITICAL FOR CUE WORD MODE - ACCURACY CALCULATION:
- If the user only spoke the cue words themselves (e.g., 10 words), but the full speech has 100 words, accuracy = 10%
- High accuracy (80%+) requires speaking most/all of the full original text, not just the prompts
- Missing entire sections between cue words heavily reduces accuracy
- Example: Original has 50 words, user spoke 15 words correctly = 30% accuracy
- DO NOT give high scores for partial recall
` : ''}

IMPORTANT: All feedback text (toneFeedback, analysis) MUST be in ${languageNames[feedbackLanguage] || 'Swedish'}.

Respond ONLY with valid JSON (no markdown, no code blocks, no extra text). Use \\n for newlines in strings:
{
  "accuracy": <number 0-100 based on FULL SPEECH recall>,
  "missedWords": ["word1", "word2", ...],
  "delayedWords": ["word3", "word4", ...],
  "fillerWords": {"uh": 2, "um": 3},
  "toneFeedback": "detailed feedback in ${languageNames[feedbackLanguage]} (use \\n for line breaks)",
  "analysis": "comprehensive feedback in ${languageNames[feedbackLanguage]} covering: how well they recalled the FULL speech, specific sections missed, whether they went beyond just cue words, suggestions for improvement (use \\n for line breaks)"
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
          { role: 'system', content: `You are a speech analysis assistant focused on measuring FULL SPEECH memorization. Calculate accuracy as: (correctly spoken words / total words in original speech) × 100. Always respond with ONLY valid JSON, no markdown formatting. Provide feedback in ${languageNames[feedbackLanguage]}.` },
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
      // Remove markdown code blocks if present
      let cleanedText = analysisText.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```json\s*|\s*```/g, '');
      }
      
      // Try to find JSON object
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
      
      // Validate accuracy is a number
      if (typeof analysis.accuracy !== 'number') {
        analysis.accuracy = parseFloat(analysis.accuracy) || 0;
      }
      
      console.log('Parsed analysis:', { 
        accuracy: analysis.accuracy, 
        missedWordsCount: analysis.missedWords?.length || 0,
        delayedWordsCount: analysis.delayedWords?.length || 0 
      });
      
    } catch (e) {
      console.error('Failed to parse analysis JSON:', e);
      console.error('Raw text was:', analysisText);
      analysis = {
        accuracy: 0,
        missedWords: [],
        delayedWords: [],
        fillerWords: {},
        toneFeedback: 'Unable to analyze tone',
        analysis: 'Unable to parse detailed analysis. Please try again.'
      };
    }

    // Generate updated cue words based on performance
    // Only include words that need MORE practice (missed or delayed)
    console.log('Generating updated cue words...');
    
    const problematicWords = [...(analysis.missedWords || []), ...(analysis.delayedWords || [])];
    
    const cuePrompt = `Based on the user's performance, create an UPDATED simplified "cue text" version for their next practice session.

IMPORTANT: The cue text MUST be in ${languageNames[speechLanguage] || 'English'} (same language as the original speech).

FULL ORIGINAL SPEECH (in ${languageNames[speechLanguage]}): "${originalText}"

Words/sections the user struggled with or missed: ${problematicWords.join(', ')}

Current accuracy: ${analysis.accuracy}%

Create an updated cue text that:
1. FOCUSES on the words/sections that need MORE practice (the problematic ones)
2. REMOVES words that were spoken confidently and correctly
3. Keeps enough context to maintain the flow and meaning
4. Uses "..." to indicate removed/mastered sections
5. Should be SHORTER than the original if performance is improving (${analysis.accuracy}% accuracy)
6. Should include MORE detail if performance is poor (<70% accuracy)
7. MUST be in ${languageNames[speechLanguage] || 'English'}

${analysis.accuracy >= 90 ? 'User is doing great - create a very minimal cue text with only the hardest words' : ''}
${analysis.accuracy < 50 ? 'User needs more support - keep more context words to help recall' : ''}

Example logic:
- If user spoke a section perfectly, replace it with "..."
- If user missed a word, KEEP that word and some context
- If entire section was skipped, include the full section

Return ONLY the updated cue text in ${languageNames[speechLanguage] || 'English'}, no explanations.`;

    const cueResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You create adaptive cue texts that help users memorize speeches. Cue texts must be in ${languageNames[speechLanguage]}.` },
          { role: 'user', content: cuePrompt }
        ],
      }),
    });

    if (!cueResponse.ok) {
      const error = await cueResponse.text();
      console.error('Cue generation error:', error);
      // Don't throw - use existing cue text as fallback
    }

    let newCueText = originalText; // Default to full text if generation fails
    try {
      const cueData = await cueResponse.json();
      newCueText = cueData.choices[0].message.content.trim();
      console.log('Generated updated cue text:', newCueText);
    } catch (e) {
      console.error('Error generating cue text, using original:', e);
    }

    // Calculate next practice interval using spaced repetition
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('interval_days')
      .eq('speech_id', speechId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentInterval = scheduleData?.interval_days || 1;
    
    // Calculate next interval based on FULL SPEECH accuracy
    let nextInterval = 1;
    if (analysis.accuracy >= 90) {
      nextInterval = Math.min(currentInterval * 2, 30);
    } else if (analysis.accuracy >= 70) {
      nextInterval = Math.min(currentInterval + 2, 20);
    } else {
      nextInterval = 1;
    }

    // Update mastery level (weighted average favoring recent performance)
    const { data: speechData } = await supabase
      .from('speeches')
      .select('mastery_level')
      .eq('id', speechId)
      .single();

    const currentMastery = speechData?.mastery_level || 0;
    const newMastery = (currentMastery * 0.7) + (analysis.accuracy * 0.3);

    await supabase
      .from('speeches')
      .update({ 
        mastery_level: newMastery,
        text_current: newCueText // Update to new adaptive cue text
      })
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

    console.log('Analysis complete:', {
      accuracy: analysis.accuracy,
      mastery: Math.round(newMastery),
      nextInterval,
      cueTextUpdated: newCueText !== originalText
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
        cueText: newCueText,
        nextPracticeInterval: nextInterval,
        nextPracticeDate: nextReviewDate.toISOString(),
        masteryLevel: Math.round(newMastery),
        practiceMode: practiceMode
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
