import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { speechId } = await req.json();

    if (!speechId) {
      throw new Error('Speech ID is required');
    }

    console.log('📝 Segmenting speech:', speechId);

    // Get the speech
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('text_original')
      .eq('id', speechId)
      .single();

    if (speechError || !speech) {
      throw new Error('Speech not found');
    }

    const text = speech.text_original;
    const words = text.split(/\s+/);
    const segments: Array<{
      speech_id: string;
      segment_order: number;
      start_word_index: number;
      end_word_index: number;
      segment_text: string;
    }> = [];

    // Segment based on natural boundaries
    let currentSegmentStart = 0;
    let segmentOrder = 0;
    const TARGET_SEGMENT_SIZE = 30; // ~30 words per segment
    const MIN_SEGMENT_SIZE = 15;

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let wordIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.trim().split(/\s+/).filter((w: string) => w);
      
      if (paragraphWords.length === 0) continue;

      // If paragraph is small enough, it's one segment
      if (paragraphWords.length <= TARGET_SEGMENT_SIZE) {
        const segmentText = paragraphWords.join(' ');
        segments.push({
          speech_id: speechId,
          segment_order: segmentOrder++,
          start_word_index: wordIndex,
          end_word_index: wordIndex + paragraphWords.length - 1,
          segment_text: segmentText,
        });
        wordIndex += paragraphWords.length;
      } else {
        // Split larger paragraphs by sentences
        const sentences = paragraph.split(/[.!?]+/).filter((s: string) => s.trim());
        let currentChunk: string[] = [];
        let chunkStartIndex = wordIndex;

        for (const sentence of sentences) {
          const sentenceWords = sentence.trim().split(/\s+/).filter((w: string) => w);
          
          // If adding this sentence exceeds target, save current chunk
          if (currentChunk.length > 0 && 
              currentChunk.length + sentenceWords.length > TARGET_SEGMENT_SIZE &&
              currentChunk.length >= MIN_SEGMENT_SIZE) {
            
            const segmentText = currentChunk.join(' ');
            segments.push({
              speech_id: speechId,
              segment_order: segmentOrder++,
              start_word_index: chunkStartIndex,
              end_word_index: chunkStartIndex + currentChunk.length - 1,
              segment_text: segmentText,
            });
            
            chunkStartIndex = wordIndex;
            currentChunk = [];
          }

          currentChunk.push(...sentenceWords);
          wordIndex += sentenceWords.length;
        }

        // Save remaining chunk
        if (currentChunk.length > 0) {
          const segmentText = currentChunk.join(' ');
          segments.push({
            speech_id: speechId,
            segment_order: segmentOrder++,
            start_word_index: chunkStartIndex,
            end_word_index: chunkStartIndex + currentChunk.length - 1,
            segment_text: segmentText,
          });
        }
      }
    }

    console.log(`✅ Created ${segments.length} segments`);

    // Delete existing segments if any
    await supabase
      .from('speech_segments')
      .delete()
      .eq('speech_id', speechId);

    // Insert new segments
    const { error: insertError } = await supabase
      .from('speech_segments')
      .insert(segments);

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        segmentCount: segments.length,
        segments 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Error segmenting speech:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});