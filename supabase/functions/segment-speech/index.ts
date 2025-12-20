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
    
    // Determine segment size based on total speech length
    // Aim for 2-4 sentences per segment (roughly 60-100 words)
    const totalWords = words.length;
    let TARGET_SEGMENT_SIZE: number;
    let MIN_SEGMENT_SIZE: number;
    const MIN_SENTENCES_PER_SEGMENT = 2;
    
    if (totalWords <= 100) {
      // Short speech: 1-2 larger segments
      TARGET_SEGMENT_SIZE = 80;
      MIN_SEGMENT_SIZE = 40;
    } else if (totalWords <= 300) {
      // Medium speech: fewer, larger segments
      TARGET_SEGMENT_SIZE = 80;
      MIN_SEGMENT_SIZE = 50;
    } else {
      // Long speech: balanced segments of ~70 words
      TARGET_SEGMENT_SIZE = 70;
      MIN_SEGMENT_SIZE = 45;
    }
    
    console.log(`📏 Speech length: ${totalWords} words. Target segment size: ${TARGET_SEGMENT_SIZE} words`);

    // Count sentences in text
    const countSentences = (text: string): number => {
      const matches = text.match(/[.!?]+/g);
      return matches ? matches.length : 0;
    };

    // If speech is short enough AND has less than 4 sentences, don't segment it
    if (totalWords <= MIN_SEGMENT_SIZE || countSentences(text) < 4) {
      console.log('📝 Speech is short or has few sentences - no segmentation needed');
      const segmentText = text.trim();
      segments.push({
        speech_id: speechId,
        segment_order: 0,
        start_word_index: 0,
        end_word_index: totalWords - 1,
        segment_text: segmentText,
      });
    } else {
      // Segment longer speeches
      console.log('✂️ Segmenting speech into manageable chunks with at least 2 sentences each');

    // Split by paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let wordIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphWords = paragraph.trim().split(/\s+/).filter((w: string) => w);
      const paragraphSentences = countSentences(paragraph);
      
      if (paragraphWords.length === 0) continue;

      // If paragraph has 2-3 sentences and reasonable size, keep as one segment
      if (paragraphSentences >= 2 && paragraphSentences <= 4 && paragraphWords.length <= TARGET_SEGMENT_SIZE * 1.5) {
        const segmentText = paragraphWords.join(' ');
        segments.push({
          speech_id: speechId,
          segment_order: segmentOrder++,
          start_word_index: wordIndex,
          end_word_index: wordIndex + paragraphWords.length - 1,
          segment_text: segmentText,
        });
        wordIndex += paragraphWords.length;
      } else if (paragraphSentences < 2) {
        // Paragraph has less than 2 sentences - try to merge with previous segment
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          const combinedText = lastSegment.segment_text + ' ' + paragraphWords.join(' ');
          const combinedWords = combinedText.split(/\s+/).length;
          
          // Merge if combined length is reasonable
          if (combinedWords <= TARGET_SEGMENT_SIZE * 1.5) {
            lastSegment.segment_text = combinedText;
            lastSegment.end_word_index = wordIndex + paragraphWords.length - 1;
            wordIndex += paragraphWords.length;
            continue;
          }
        }
        // Can't merge - add as separate segment
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
        // Split larger paragraphs by sentences, ensuring at least 2 sentences per segment
        const sentenceMatches = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        let currentChunk: string[] = [];
        let chunkStartIndex = wordIndex;
        let sentenceCount = 0;

        for (const sentence of sentenceMatches) {
          const sentenceWords = sentence.trim().split(/\s+/).filter((w: string) => w);
          
          // Only create a new segment if:
          // 1. We have at least MIN_SENTENCES_PER_SEGMENT sentences
          // 2. Adding this sentence would exceed TARGET size
          // 3. Current chunk meets MIN size
          if (currentChunk.length > 0 && 
              sentenceCount >= MIN_SENTENCES_PER_SEGMENT &&
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
            sentenceCount = 0;
          }

          currentChunk.push(...sentenceWords);
          wordIndex += sentenceWords.length;
          sentenceCount++;
        }

        // Save remaining chunk - merge with previous if too small
        if (currentChunk.length > 0) {
          if (sentenceCount < MIN_SENTENCES_PER_SEGMENT && segments.length > 0) {
            // Try to merge with previous segment
            const lastSegment = segments[segments.length - 1];
            const combinedText = lastSegment.segment_text + ' ' + currentChunk.join(' ');
            lastSegment.segment_text = combinedText;
            lastSegment.end_word_index = chunkStartIndex + currentChunk.length - 1;
          } else {
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
    }
    } // Close else block for segmentation

    // Post-process: merge any segments with less than 2 sentences
    const finalSegments: typeof segments = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const sentenceCount = countSentences(seg.segment_text);
      
      if (sentenceCount < 2 && finalSegments.length > 0) {
        // Merge with previous
        const prevSeg = finalSegments[finalSegments.length - 1];
        prevSeg.segment_text = prevSeg.segment_text + ' ' + seg.segment_text;
        prevSeg.end_word_index = seg.end_word_index;
      } else if (sentenceCount < 2 && i < segments.length - 1) {
        // Merge with next
        segments[i + 1].segment_text = seg.segment_text + ' ' + segments[i + 1].segment_text;
        segments[i + 1].start_word_index = seg.start_word_index;
      } else {
        finalSegments.push({ ...seg, segment_order: finalSegments.length });
      }
    }

    console.log(`✅ Created ${finalSegments.length} segments (each with 2+ sentences)`);

    // Delete existing segments if any
    await supabase
      .from('speech_segments')
      .delete()
      .eq('speech_id', speechId);

    // Insert new segments
    const { error: insertError } = await supabase
      .from('speech_segments')
      .insert(finalSegments.length > 0 ? finalSegments : segments);

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