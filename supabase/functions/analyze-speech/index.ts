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

    // Get current mastery level and familiarity BEFORE generating cue words
    const { data: speechData } = await supabase
      .from('speeches')
      .select('mastery_level, familiarity_level')
      .eq('id', speechId)
      .single();

    const currentMastery = speechData?.mastery_level || 0;
    const familiarityLevel = speechData?.familiarity_level || 'new';

    // PROGRESSIVE LEARNING FLOW: Generate updated cue words based on mastery level
    // Adjusted by familiarity level for personalized learning
    console.log('Generating updated cue words...');
    console.log('Current mastery level:', currentMastery);
    console.log('Familiarity level:', familiarityLevel);
    
    let newCueText = originalText; // Default to full text
    
    const problematicWords = [...(analysis.missedWords || []), ...(analysis.delayedWords || [])];
    
    // Adjust mastery thresholds based on familiarity
    // For 'new' texts: standard progression
    // For 'familiar' texts: start at phase 2 (mastery +30)
    // For 'well_known' texts: start at phase 3 (mastery +60)
    let effectiveMastery = currentMastery;
    if (familiarityLevel === 'familiar') {
      effectiveMastery = Math.max(currentMastery, 30);
      console.log('Adjusted for familiar text - effective mastery:', effectiveMastery);
    } else if (familiarityLevel === 'well_known') {
      effectiveMastery = Math.max(currentMastery, 60);
      console.log('Adjusted for well-known text - effective mastery:', effectiveMastery);
    }
    
    // PHASE 1: Initial Reading Sessions (mastery < 30)
    // Keep FULL original text - user needs to familiarize with complete speech
    if (effectiveMastery < 30) {
      console.log('PHASE 1: Initial reading - keeping full original text');
      newCueText = originalText;
    }
    // PHASE 2: Early Cue-Word Introduction (mastery 30-60)
    // Start removing only very small, non-essential words
    else if (effectiveMastery < 60) {
      console.log('PHASE 2: Early cue-words - removing small non-essential words');
      
      const cuePrompt = `Based on the user's performance, create an UPDATED "cue text" for their next practice session.

IMPORTANT: The cue text MUST be in ${languageNames[speechLanguage] || 'English'} (same language as the original speech).

FULL ORIGINAL SPEECH (in ${languageNames[speechLanguage]}): "${originalText}"

Words/sections the user struggled with: ${problematicWords.join(', ')}

Current accuracy: ${analysis.accuracy}%
Mastery level: ${currentMastery} (EARLY STAGE)

INSTRUCTIONS FOR EARLY STAGE:
1. Keep the speech MOSTLY COMPLETE - user is still familiarizing
2. ONLY remove very small, non-essential words like: "the", "and", "of", "a", "an", "in", "on", "at"
3. KEEP ALL core words, verbs, nouns, adjectives, and adverbs
4. KEEP ALL problematic words and their surrounding context: ${problematicWords.join(', ')}
5. Use "..." SPARINGLY - only for 1-2 word removals of very simple words
6. The cue text should still be 70-90% of the original length
7. MUST be in ${languageNames[speechLanguage] || 'English'}

Example: "The cat sat on the mat" → "... cat sat ... mat" (only removed articles)

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
            { role: 'system', content: `You create adaptive cue texts for early-stage speech learning. Remove only very small words. Cue texts must be in ${languageNames[speechLanguage]}.` },
            { role: 'user', content: cuePrompt }
          ],
        }),
      });

      if (cueResponse.ok) {
        const cueData = await cueResponse.json();
        newCueText = cueData.choices[0].message.content.trim();
        console.log('Generated early-stage cue text:', newCueText.substring(0, 100));
      } else {
        newCueText = originalText;
      }
    }
    // PHASE 3: Advanced Cue-Words (mastery 60-85)
    // More aggressive removal, focus on difficult sections
    else if (effectiveMastery < 85) {
      console.log('PHASE 3: Advanced cue-words - focusing on difficult sections');
      
      const cuePrompt = `Based on the user's performance, create an UPDATED "cue text" for their next practice session.

IMPORTANT: The cue text MUST be in ${languageNames[speechLanguage] || 'English'} (same language as the original speech).

FULL ORIGINAL SPEECH (in ${languageNames[speechLanguage]}): "${originalText}"

Words/sections the user struggled with: ${problematicWords.join(', ')}

Current accuracy: ${analysis.accuracy}%
Mastery level: ${currentMastery} (ADVANCED STAGE)

INSTRUCTIONS FOR ADVANCED STAGE:
1. User has good familiarity - remove more words to challenge memory
2. KEEP ALL problematic words and their immediate context: ${problematicWords.join(', ')}
3. REMOVE words that were consistently spoken correctly
4. Remove small words (the, and, of, a) AND some easier content words
5. Use "..." to indicate mastered sections
6. The cue text should be 40-60% of the original length
7. Focus on difficult transitions and problematic areas
8. MUST be in ${languageNames[speechLanguage] || 'English'}

Example: "The quick brown fox jumped over the lazy dog" → "... quick ... fox jumped ... lazy dog"

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
            { role: 'system', content: `You create adaptive cue texts for advanced speech learning. Focus on difficult sections. Cue texts must be in ${languageNames[speechLanguage]}.` },
            { role: 'user', content: cuePrompt }
          ],
        }),
      });

      if (cueResponse.ok) {
        const cueData = await cueResponse.json();
        newCueText = cueData.choices[0].message.content.trim();
        console.log('Generated advanced cue text:', newCueText.substring(0, 100));
      } else {
        newCueText = originalText;
      }
    }
    // PHASE 4: Near Mastery (mastery >= 85)
    // Minimal cues - only the hardest words
    else {
      console.log('PHASE 4: Near mastery - minimal cues only');
      
      const cuePrompt = `Based on the user's performance, create MINIMAL cue text for their next practice session.

IMPORTANT: The cue text MUST be in ${languageNames[speechLanguage] || 'English'} (same language as the original speech).

FULL ORIGINAL SPEECH (in ${languageNames[speechLanguage]}): "${originalText}"

Words/sections the user struggled with: ${problematicWords.join(', ')}

Current accuracy: ${analysis.accuracy}%
Mastery level: ${currentMastery} (NEAR MASTERY)

INSTRUCTIONS FOR NEAR MASTERY:
1. User has excellent recall - provide MINIMAL cues
2. ONLY include the hardest words: ${problematicWords.join(', ')}
3. Use "..." extensively for mastered sections
4. The cue text should be 10-30% of the original length
5. Include only critical transition points and problem areas
6. Challenge the user to recall from memory
7. MUST be in ${languageNames[speechLanguage] || 'English'}

Example: "The quick brown fox jumped over the lazy dog" → "... fox ... dog"

Return ONLY the minimal cue text in ${languageNames[speechLanguage] || 'English'}, no explanations.`;

      const cueResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `You create minimal cue texts for near-mastery speech learning. Provide only essential cues. Cue texts must be in ${languageNames[speechLanguage]}.` },
            { role: 'user', content: cuePrompt }
          ],
        }),
      });

      if (cueResponse.ok) {
        const cueData = await cueResponse.json();
        newCueText = cueData.choices[0].message.content.trim();
        console.log('Generated minimal cue text:', newCueText.substring(0, 100));
      } else {
        // Fallback: create minimal cues manually from problematic words
        if (problematicWords.length > 0) {
          newCueText = '... ' + problematicWords.join(' ... ') + ' ...';
        } else {
          newCueText = '...';
        }
      }
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
