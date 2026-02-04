import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Beat {
  beat_order: number;
  sentence_1_text: string;
  sentence_2_text: string;
  sentence_3_text: string;
}

// AI-powered sentence splitting for long sentences
// Returns an array of shorter sentence fragments at natural breakpoints
async function splitLongSentenceWithAI(sentence: string): Promise<string[]> {
  const wordCount = sentence.split(/\s+/).filter(Boolean).length;
  
  // Only split sentences longer than 25 words
  if (wordCount <= 25) {
    return [sentence];
  }
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, skipping AI sentence splitting');
    return [sentence];
  }
  
  try {
    console.log(`Splitting long sentence (${wordCount} words) with AI...`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You split long sentences into 2-3 shorter, natural phrases for memorization practice.

Rules:
1. Find natural pause points - usually after a comma that completes a logical phrase
2. Each fragment should be 8-25 words ideally  
3. Keep ALL original words intact - don't rephrase or remove anything
4. Fragments ending mid-sentence should end with a comma
5. The final fragment keeps the original punctuation (. ! ?)
6. Return ONLY a JSON array of strings, nothing else
7. Aim for 2-3 fragments total

Example input: "Jag, Ebba Hallert Djurberg, överläkare och min kollega Norah Hamberg, Specialistsjuksköterska hos den palliativa vårdavdelningen på karolinska institutet sedan 20 respektive 25 år tillbaka, skall idag debattera kring just denna svåra frågeställning."

Example output: ["Jag, Ebba Hallert Djurberg, överläkare och min kollega Norah Hamberg,", "Specialistsjuksköterska hos den palliativa vårdavdelningen på karolinska institutet sedan 20 respektive 25 år tillbaka,", "skall idag debattera kring just denna svåra frågeställning."]`
          },
          {
            role: 'user',
            content: `Split this sentence into shorter fragments:\n\n${sentence}`
          }
        ],
        temperature: 0.1,
      }),
    });
    
    if (!response.ok) {
      console.error('AI API error:', response.status);
      return [sentence];
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (!content) {
      console.log('No AI response, keeping original sentence');
      return [sentence];
    }
    
    // Parse the JSON array from the response
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    
    const fragments = JSON.parse(jsonStr);
    
    if (Array.isArray(fragments) && fragments.length > 1) {
      console.log(`AI split sentence into ${fragments.length} fragments`);
      // Ensure each fragment is trimmed and has proper punctuation
      return fragments.map((f: string, i: number) => {
        const trimmed = f.trim();
        // Add comma if not already ending with punctuation (except for last fragment)
        if (i < fragments.length - 1 && !/[.!?,;]$/.test(trimmed)) {
          return trimmed + ',';
        }
        return trimmed;
      });
    }
    
    return [sentence];
  } catch (error) {
    console.error('AI sentence splitting failed:', error);
    return [sentence];
  }
}

// Split text into sentences, preserving punctuation
// Sentence endings: ONLY . ! ? (periods, exclamation marks, question marks)
// Commas NEVER split sentences - they are part of the sentence
async function splitIntoSentences(text: string): Promise<string[]> {
  const normalized = (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  const out: string[] = [];
  let currentSentence = "";

  // Split by whitespace to process word by word
  const tokens = normalized.split(/(\s+)/);

  for (const token of tokens) {
    if (!token) continue;

    // If it's just whitespace, add to current sentence
    if (/^\s+$/.test(token)) {
      currentSentence += token;
      continue;
    }

    currentSentence += token;

    // Check if token ends with sentence-ending punctuation (ONLY . ! ?)
    // Commas are NOT sentence endings
    if (/[.!?]$/.test(token)) {
      // Definite sentence end
      const trimmed = currentSentence.trim();
      if (trimmed) {
        out.push(trimmed);
      }
      currentSentence = "";
    }
    // Commas are just part of the sentence - no special handling
  }

  // Handle any remaining text
  const remaining = currentSentence.trim();
  if (remaining) {
    // Ensure it ends with punctuation
    const finalSentence = /[.!?]$/.test(remaining) ? remaining : remaining + ".";
    out.push(finalSentence);
  }

  // Handle line breaks within sentences - split multi-line chunks
  const lineProcessed: string[] = [];
  for (const sentence of out) {
    const lines = sentence
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length >= 3) {
      // For multi-line chunks, group 2 lines together
      for (let i = 0; i < lines.length; i += 2) {
        let group = lines.slice(i, i + 2).join(" ").trim();
        // Ensure it ends with punctuation
        if (group && !/[.!?]$/.test(group)) {
          group += ".";
        }
        if (group) lineProcessed.push(group);
      }
    } else {
      // Join lines and ensure punctuation at end
      let joinedSentence = lines.join(" ").trim();
      if (joinedSentence && !/[.!?]$/.test(joinedSentence)) {
        joinedSentence += ".";
      }
      if (joinedSentence) lineProcessed.push(joinedSentence);
    }
  }

  // AI-powered splitting of long sentences
  const finalOut: string[] = [];
  for (const sentence of lineProcessed) {
    const fragments = await splitLongSentenceWithAI(sentence);
    finalOut.push(...fragments);
  }

  return finalOut;
}

// Count total words in the speech
function countWords(sentences: string[]): number {
  return sentences.reduce((total, s) => total + s.split(/\s+/).filter(Boolean).length, 0);
}

// Determine sentences per beat based on total word count
// STRICT LIMIT: Maximum 3 sentences per beat, never more
function getSentencesPerBeat(totalWords: number): number {
  if (totalWords <= 3) return 1;
  if (totalWords <= 6) return 2;
  return 3; // MAXIMUM - never exceed this
}

// Group sentences into beats based on speech length
// STRICT RULES:
// - Maximum 3 parts (sentences) per beat
// - Each part can be maximum 3 sentences from original text
// - Never put entire speech in one beat
function createBeats(sentences: string[]): Beat[] {
  const beats: Beat[] = [];
  const totalWords = countWords(sentences);
  const sentencesPerBeat = getSentencesPerBeat(totalWords);

  console.log(`Creating beats - Total sentences: ${sentences.length}, Total words: ${totalWords}, sentences per beat: ${sentencesPerBeat}`);

  // STRICT: Always iterate through ALL sentences, grouping by sentencesPerBeat
  // This ensures we never accidentally put all sentences in one beat
  let i = 0;
  while (i < sentences.length) {
    const sentence1 = (sentences[i] ?? "").trim();
    if (!sentence1) {
      i++;
      continue;
    }

    // Get sentence2 and sentence3 based on sentencesPerBeat
    // STRICT: Only include additional sentences if sentencesPerBeat allows
    let sentence2 = "";
    let sentence3 = "";

    if (sentencesPerBeat === 1) {
      // For 1-sentence beats, only use sentence1 (leave others empty)
      sentence2 = "";
      sentence3 = "";
      i += 1;
    } else if (sentencesPerBeat === 2) {
      // For 2-sentence beats, use sentence1 and sentence2
      sentence2 = (sentences[i + 1] ?? "").trim();
      sentence3 = "";
      i += 2;
    } else {
      // For 3-sentence beats (MAXIMUM)
      sentence2 = (sentences[i + 1] ?? "").trim();
      sentence3 = (sentences[i + 2] ?? "").trim();
      i += 3;
    }

    const beatOrder = beats.length;
    console.log(`Beat ${beatOrder}: s1="${sentence1.substring(0, 30)}...", s2="${sentence2.substring(0, 30)}...", s3="${sentence3.substring(0, 30)}..."`);

    beats.push({
      beat_order: beatOrder,
      sentence_1_text: sentence1,
      sentence_2_text: sentence2,
      sentence_3_text: sentence3,
    });
  }

  console.log(`Created ${beats.length} beats from ${sentences.length} sentences`);
  return beats;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    if (!authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with anon key for auth validation
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getUser(token);

    if (claimsError || !claimsData?.user) {
      console.error('Auth error:', claimsError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const user = claimsData.user;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { speechId } = await req.json();

    if (!speechId) {
      return new Response(
        JSON.stringify({ error: 'speechId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('id, text_original, user_id')
      .eq('id', speechId)
      .single();

    if (speechError || !speech) {
      return new Response(
        JSON.stringify({ error: 'Speech not found', details: speechError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (speech.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Split into sentences (async for AI-powered long sentence splitting)
    const sentences = await splitIntoSentences(speech.text_original);
    console.log(`Found ${sentences.length} sentences in speech`);

    // Create beats (groups of 3 sentences)
    const beats = createBeats(sentences);
    console.log(`Created ${beats.length} beats`);

    // Delete existing beats for this speech
    const { error: deleteError } = await supabase
      .from('practice_beats')
      .delete()
      .eq('speech_id', speechId);

    if (deleteError) {
      console.error('Error deleting old beats:', deleteError);
    }

    // Insert new beats
    const beatsToInsert = beats.map(beat => ({
      speech_id: speechId,
      beat_order: beat.beat_order,
      sentence_1_text: beat.sentence_1_text,
      sentence_2_text: beat.sentence_2_text,
      sentence_3_text: beat.sentence_3_text,
      is_mastered: false,
    }));

    const { data: insertedBeats, error: insertError } = await supabase
      .from('practice_beats')
      .insert(beatsToInsert)
      .select();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Failed to insert beats', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        speechId,
        totalSentences: sentences.length,
        totalBeats: beats.length,
        beats: insertedBeats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in segment-speech-into-beats:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request', code: 'PROCESSING_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
