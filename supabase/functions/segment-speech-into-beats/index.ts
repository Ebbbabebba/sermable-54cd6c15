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
function splitIntoSentences(text: string): string[] {
  const normalized = (text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!normalized) return [];

  // 1) Split by sentence-ending punctuation. Also keep any trailing text without punctuation.
  const baseSentences = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [normalized];

  // 2) If a "sentence" spans many line breaks (common in poems/scripts),
  // split it into smaller chunks by grouping 2 lines together.
  const out: string[] = [];

  for (const s of baseSentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    const lines = trimmed
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length >= 3) {
      for (let i = 0; i < lines.length; i += 2) {
        const group = lines.slice(i, i + 2).join(" ").trim();
        if (group) out.push(group);
      }
      continue;
    }

    out.push(lines.join(" "));
  }

  return out;
}

// Group sentences into beats of 3
function createBeats(sentences: string[]): Beat[] {
  const beats: Beat[] = [];

  for (let i = 0; i < sentences.length; i += 3) {
    const sentence1 = (sentences[i] ?? "").trim();
    if (!sentence1) continue;

    const sentence2 = (sentences[i + 1] ?? sentence1).trim();
    const sentence3 = (sentences[i + 2] ?? sentence2).trim();

    beats.push({
      beat_order: beats.length,
      sentence_1_text: sentence1,
      sentence_2_text: sentence2,
      sentence_3_text: sentence3,
    });
  }

  return beats;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
