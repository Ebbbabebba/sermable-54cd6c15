import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common word variations that should be accepted as equivalent
const COMMON_VARIATIONS: Record<string, string[]> = {
  "going to": ["gonna", "going to"],
  "want to": ["wanna", "want to"],
  "got to": ["gotta", "got to"],
  "kind of": ["kinda", "kind of"],
  "sort of": ["sorta", "sort of"],
  "because": ["because", "cause", "cuz"],
  "them": ["them", "'em"],
  "you": ["you", "ya", "yah"],
  "and": ["and", "n"],
};

// Acceptable homophone swaps (speech recognition errors)
const ACCEPTABLE_SWAPS = [
  ["their", "there", "they're"],
  ["your", "you're"],
  ["its", "it's"],
  ["to", "too", "two"],
  ["then", "than"],
  ["here", "hear"],
  ["know", "no"],
  ["write", "right"],
  ["see", "sea"],
  ["for", "four"],
];

// Filler words to ignore
const FILLER_WORDS = new Set([
  "um", "uh", "like", "you know", "sort of", "kind of", 
  "i mean", "actually", "basically", "literally", "seriously"
]);

// Levenshtein distance for fuzzy word matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if two words are similar enough (fuzzy matching)
function isSimilarWord(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();
  
  // Exact match
  if (w1 === w2) return true;
  
  // Check common variations
  for (const [standard, variations] of Object.entries(COMMON_VARIATIONS)) {
    if (variations.includes(w1) && variations.includes(w2)) return true;
  }
  
  // Check acceptable swaps (homophones)
  for (const group of ACCEPTABLE_SWAPS) {
    if (group.includes(w1) && group.includes(w2)) return true;
  }
  
  // Length difference too large = different words
  const maxLength = Math.max(w1.length, w2.length);
  if (Math.abs(w1.length - w2.length) > maxLength * 0.4) return false;
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(w1, w2);
  
  // Allow 1-2 character differences for words > 4 letters
  if (w1.length > 4 && distance <= 2) return true;
  if (w1.length <= 4 && distance <= 1) return true;
  
  return false;
}

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

    const { audio, originalText, speechId, userTier, language, skillLevel } = await req.json();
    
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

    // Pre-analysis: Check word overlap with fuzzy matching
    console.log('Pre-analysis: Checking word overlap...');
    const originalWords = originalText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    const spokenWords = spokenText.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
    
    // Remove filler words from spoken text
    const cleanSpoken = spokenWords.filter((w: string) => !FILLER_WORDS.has(w));
    
    // Count fuzzy matches
    let matchCount = 0;
    const matched = new Set<number>();
    for (const origWord of originalWords) {
      for (let i = 0; i < cleanSpoken.length; i++) {
        if (!matched.has(i) && isSimilarWord(origWord, cleanSpoken[i])) {
          matchCount++;
          matched.add(i);
          break;
        }
      }
    }
    
    const overlapPercent = originalWords.length > 0 ? (matchCount / originalWords.length) * 100 : 0;
    console.log(`Word overlap: ${matchCount}/${originalWords.length} (${overlapPercent.toFixed(1)}%)`);
    
    // If overlap is too low, it's likely a different speech
    if (overlapPercent < 35) {
      console.log('⚠️ Low word overlap detected - likely different speech');
      return new Response(
        JSON.stringify({
          transcription: spokenText,
          accuracy: Math.min(15, overlapPercent / 2),
          missedWords: originalWords.slice(0, 20),
          delayedWords: [],
          connectorWords: [],
          difficultyScore: 50,
          analysis: "The spoken content doesn't match the original speech. Please speak the correct speech.",
          cueText: originalText,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Use AI to analyze the speech and identify issues
    console.log('Analyzing speech patterns...');
    
    const analysisPrompt = `Analyze this speech practice session and return ONLY valid JSON.

Original FULL speech text: "${originalText}"
Spoken text: "${spokenText}"
Language: ${audioLanguage}
Speaker skill level: ${skillLevel || 'beginner'}

VALIDATION RULES - BALANCED APPROACH:

ACCEPT AS CORRECT:
✅ Contractions and expansions: "I'm" = "I am", "gonna" = "going to", "wanna" = "want to", "gotta" = "got to"
✅ Pronunciation variants of the SAME word: Different pronunciations of "tomato", "either", regional accents
✅ Speech recognition errors (homophones): "their/there/they're", "your/you're", "its/it's", "to/too/two"
✅ Filler words: Completely IGNORE "um", "uh", "like", "you know", "I mean" - don't penalize at all
✅ Minor word order changes IF natural: "I really think" = "I think really" (accept if meaning unchanged)
✅ Common contractions: "cause" = "because", "'em" = "them", "ya" = "you"

REJECT AS INCORRECT:
❌ Semantically different words: "shares" ≠ "chairs", "Alex" ≠ "Ebba", "investment" ≠ "environment", "morning" ≠ "evening"
❌ Completely missing words (not just skipped filler words)
❌ Speaking about a different topic or subject matter entirely
❌ Adding long segments of completely unrelated content
❌ Excessive word repetition that changes meaning (saying same word 5+ times)

ACCURACY CALCULATION:
- Base accuracy = (matching words / total original words) × 100
- Use fuzzy matching: Allow 1-2 character differences in similar words
- IGNORE filler word differences completely
- Only penalize if word is semantically different OR completely missing
- If spoken text is about a completely different topic, accuracy should be 0-20%
- If 70%+ words match but topic is different, accuracy should be 30-50%
- Natural pronunciation variations should NOT reduce accuracy

CONTEXT VALIDATION:
- Check if the general topic/theme matches (not just individual words)
- Example: Original about "daily routine" but spoken about "investment strategies" = different speech (0-20% accuracy)
- Example: Original about "Alex's morning" but spoken about "Sarah's evening" = different speech (0-20% accuracy)
- Example: Original about "climate change" but spoken about "weather forecast" = different speech (30-50% accuracy)

CONNECTOR WORD DETECTION:
Identify small connector words (articles, prepositions, conjunctions) from the original text:
- Common connectors: the, a, an, and, but, or, in, on, at, to, for, of, with, from, by, as, is, was, are, were, be, been, that, this, these, those, it, its

DIFFICULTY SCORING (0-100):
Calculate based on:
- Text complexity (word length, sentence structure)
- Total word count
- Presence of technical or uncommon words
- Speaking pace required

Compare them and identify:
1. accuracy: percentage match (0-100) based on fuzzy word matching with natural speech tolerance
2. missedWords: array of words COMPLETELY missing from spoken text (only clear omissions, ignore acceptable variations)
3. delayedWords: array of words with obvious long pauses (be strict - only clear hesitations)
4. connectorWords: array of connector words found in the original text
5. difficultyScore: 0-100 score indicating speech complexity
6. analysis: brief encouraging feedback focusing on content accuracy

Return ONLY this JSON structure with no extra text:
{
  "accuracy": 85,
  "missedWords": ["example1"],
  "delayedWords": ["example2"],
  "connectorWords": ["the", "and", "of"],
  "difficultyScore": 65,
  "analysis": "Good practice session"
}`;

    // Use GPT-4o-mini for fast, high-quality analysis
    const analysisModel = 'gpt-4o-mini';
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
        max_tokens: 1000,
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
      if (!Array.isArray(analysis.connectorWords)) {
        analysis.connectorWords = [];
      }
      if (typeof analysis.difficultyScore !== 'number') {
        analysis.difficultyScore = 50;
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

    // Post-analysis validation: Safety checks
    console.log('Post-analysis validation...');
    
    // Safety check 1: If AI gave high accuracy but fuzzy overlap is low, adjust
    if (analysis.accuracy > 60 && overlapPercent < 50) {
      console.log('⚠️ High AI accuracy but low word overlap - adjusting down');
      const adjustedAccuracy = Math.max(overlapPercent * 0.8, 20);
      analysis.accuracy = Math.min(analysis.accuracy, adjustedAccuracy);
      analysis.analysis = "The content doesn't match the original speech closely enough. Focus on speaking the exact words from your speech.";
    }
    
    // Safety check 2: If too many words marked as missed, cap accuracy
    const missedPercentage = originalWords.length > 0 
      ? (analysis.missedWords.length / originalWords.length) * 100 
      : 0;
    if (missedPercentage > 50) {
      console.log(`⚠️ High missed percentage (${missedPercentage.toFixed(1)}%) - capping accuracy`);
      analysis.accuracy = Math.min(analysis.accuracy, 50 - missedPercentage);
    }
    
    console.log(`Final accuracy after validation: ${analysis.accuracy}%`);

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
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You create concise cue texts. Return only the cue text with no explanations.' },
            { role: 'user', content: cuePrompt }
          ],
          max_tokens: 800,
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
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You simplify texts by removing small words. Return only the simplified text.' },
            { role: 'user', content: simpleCuePrompt }
          ],
          max_tokens: 800,
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
        connectorWords: analysis.connectorWords || [],
        difficultyScore: analysis.difficultyScore || 50,
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
