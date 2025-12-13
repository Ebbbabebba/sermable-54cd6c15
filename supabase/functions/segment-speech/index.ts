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

    // Get the speech with user_id
    const { data: speech, error: speechError } = await supabase
      .from('speeches')
      .select('text_original, user_id')
      .eq('id', speechId)
      .single();

    if (speechError || !speech) {
      throw new Error('Speech not found');
    }
    
    const userId = speech.user_id;

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
    const totalWords = words.length;
    let TARGET_SEGMENT_SIZE: number;
    let MIN_SEGMENT_SIZE: number;
    
    if (totalWords <= 100) {
      // Short speech: 1-2 segments of ~50 words
      TARGET_SEGMENT_SIZE = 50;
      MIN_SEGMENT_SIZE = 30;
    } else if (totalWords <= 300) {
      // Medium speech: 3-6 segments of ~50 words
      TARGET_SEGMENT_SIZE = 50;
      MIN_SEGMENT_SIZE = 30;
    } else {
      // Long speech: Many small segments of ~40 words
      TARGET_SEGMENT_SIZE = 40;
      MIN_SEGMENT_SIZE = 25;
    }
    
    console.log(`📏 Speech length: ${totalWords} words. Target segment size: ${TARGET_SEGMENT_SIZE} words`);

    // If speech is short enough, don't segment it
    if (totalWords <= MIN_SEGMENT_SIZE) {
      console.log('📝 Speech is short - no segmentation needed');
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
      console.log('✂️ Segmenting speech into manageable chunks');

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
    } // Close else block for segmentation

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
    
    // ========== CROSS-SPEECH LEARNING ==========
    // Initialize mastered_words from user's global word mastery
    console.log('🧠 Initializing cross-speech word mastery...');
    
    // Get user's global word mastery
    const { data: userMastery } = await supabase
      .from('user_word_mastery')
      .select('word, mastery_level, total_correct')
      .eq('user_id', userId)
      .gt('mastery_level', 30); // Only words with decent mastery
    
    if (userMastery && userMastery.length > 0) {
      console.log(`📚 Found ${userMastery.length} mastered words from previous speeches`);
      
      // Create a map for quick lookup
      const masteryMap = new Map(userMastery.map((m: any) => [m.word.toLowerCase(), m]));
      
      // Process words in the new speech
      const wordsToPreMaster: any[] = [];
      const wordsToHide: number[] = [];
      
      words.forEach((word: string, index: number) => {
        const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        if (!cleanWord) return;
        
        const existing = masteryMap.get(cleanWord);
        if (existing) {
          // User already knows this word from other speeches
          const shouldHide = existing.mastery_level >= 60 && existing.total_correct >= 3;
          
          wordsToPreMaster.push({
            speech_id: speechId,
            word: cleanWord,
            times_spoken_correctly: Math.min(existing.total_correct, 5), // Cap at 5
            missed_count: 0,
            hesitated_count: 0,
            hidden_miss_count: 0,
            hidden_hesitate_count: 0,
            is_anchor_keyword: false
          });
          
          if (shouldHide) {
            wordsToHide.push(index);
          }
        }
      });
      
      // Insert pre-mastered words
      if (wordsToPreMaster.length > 0) {
        await supabase
          .from('mastered_words')
          .upsert(wordsToPreMaster, { onConflict: 'speech_id,word' });
        console.log(`✅ Pre-initialized ${wordsToPreMaster.length} words from cross-speech mastery`);
      }
      
      // Update text_current with pre-hidden words
      if (wordsToHide.length > 0) {
        const modifiedWords = words.map((word: string, index: number) => {
          if (wordsToHide.includes(index)) {
            return `[${word}]`;
          }
          return word;
        });
        
        const textCurrent = modifiedWords.join(' ');
        const visibilityPercent = Math.round(((words.length - wordsToHide.length) / words.length) * 100);
        
        await supabase
          .from('speeches')
          .update({ 
            text_current: textCurrent,
            base_word_visibility_percent: visibilityPercent
          })
          .eq('id', speechId);
        
        console.log(`📝 Pre-hidden ${wordsToHide.length} words (${100 - visibilityPercent}% hidden from cross-speech mastery)`);
      }
    } else {
      console.log('📝 No cross-speech mastery found - starting fresh');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        segmentCount: segments.length,
        segments,
        crossSpeechWordsApplied: userMastery?.length || 0
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