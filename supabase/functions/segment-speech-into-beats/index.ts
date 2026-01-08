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
  // Match sentences ending with . ! ? and keep the punctuation
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  const matches = text.match(sentenceRegex);
  
  if (!matches) {
    // If no proper sentences found, return the whole text as one sentence
    return [text.trim()];
  }
  
  return matches.map(s => s.trim()).filter(s => s.length > 0);
}

// Group sentences into beats of 3
function createBeats(sentences: string[]): Beat[] {
  const beats: Beat[] = [];
  
  for (let i = 0; i < sentences.length; i += 3) {
    const sentence1 = sentences[i] || "";
    const sentence2 = sentences[i + 1] || "";
    const sentence3 = sentences[i + 2] || "";
    
    // Handle remainder: if we have 1-2 sentences left at the end
    if (i + 3 >= sentences.length && sentences.length > 3) {
      const remaining = sentences.length - i;
      
      if (remaining === 1 && beats.length > 0) {
        // Merge single remaining sentence with previous beat
        // Create a 4th "sentence" by combining with the last beat's 3rd sentence
        const lastBeat = beats[beats.length - 1];
        lastBeat.sentence_3_text = lastBeat.sentence_3_text + " " + sentence1;
        continue;
      } else if (remaining === 2 && beats.length > 0) {
        // Merge 2 remaining sentences with previous beat's last sentence
        const lastBeat = beats[beats.length - 1];
        lastBeat.sentence_3_text = lastBeat.sentence_3_text + " " + sentence1 + " " + sentence2;
        continue;
      }
    }
    
    // For short speeches (≤3 sentences), create one beat with whatever we have
    if (sentences.length <= 3) {
      beats.push({
        beat_order: beats.length,
        sentence_1_text: sentence1,
        sentence_2_text: sentence2 || sentence1, // Repeat if not enough
        sentence_3_text: sentence3 || sentence2 || sentence1, // Repeat if not enough
      });
      break;
    }
    
    // Normal case: create a beat with 3 sentences
    if (sentence1 && sentence2 && sentence3) {
      beats.push({
        beat_order: beats.length,
        sentence_1_text: sentence1,
        sentence_2_text: sentence2,
        sentence_3_text: sentence3,
      });
    }
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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
