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

// Split text into sentences, preserving punctuation
// Ensures each sentence ends with . , ! or ?
function splitIntoSentences(text: string): string[] {
  const normalized = (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  // Split by sentence-ending punctuation (. ! ? ,) - keeping the punctuation
  // Match: any text followed by punctuation, OR trailing text without punctuation
  const chunks = normalized.match(/[^.!?,]+[.!?,]+|[^.!?,]+$/g) ?? [normalized];

  const out: string[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    // Handle line breaks within a chunk - split into lines
    const lines = trimmed
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length >= 3) {
      // For multi-line chunks, group 2 lines together
      for (let i = 0; i < lines.length; i += 2) {
        let group = lines.slice(i, i + 2).join(" ").trim();
        // Ensure it ends with punctuation
        if (group && !/[.!?,]$/.test(group)) {
          group += ".";
        }
        if (group) out.push(group);
      }
    } else {
      // Join lines and ensure punctuation at end
      let sentence = lines.join(" ").trim();
      if (sentence && !/[.!?,]$/.test(sentence)) {
        sentence += ".";
      }
      if (sentence) out.push(sentence);
    }
  }

  return out;
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

    // Split into sentences
    const sentences = splitIntoSentences(speech.text_original);
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
