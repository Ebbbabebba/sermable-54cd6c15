import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Common simple words to hide first
const SIMPLE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'that', 'this', 'these', 'those', 'it', 'its', 'as', 'if', 'then', 'than',
  'so', 'very', 'just', 'can', 'your', 'my', 'our', 'their', 'his', 'her'
]);

interface WordPerformance {
  word: string;
  correctCount: number;
  missedCount: number;
  hesitatedCount: number;
  isSimple: boolean;
  lastPerformance: 'correct' | 'missed' | 'hesitated' | 'none';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { speechId, missedWords = [], hesitatedWords = [] } = await req.json()

    if (!speechId) {
      throw new Error('Speech ID is required')
    }

    console.log('Processing adaptive hiding for speech:', speechId)
    console.log('Missed words:', missedWords)
    console.log('Hesitated words:', hesitatedWords)

    // Get the speech
    const { data: speech, error: speechError } = await supabaseClient
      .from('speeches')
      .select('*')
      .eq('id', speechId)
      .single()

    if (speechError) throw speechError

    const words = speech.text_original.split(/\s+/).filter((w: string) => w.trim())
    
    // Get current word performance from mastered_words table
    const { data: masteredWords } = await supabaseClient
      .from('mastered_words')
      .select('*')
      .eq('speech_id', speechId)

    const wordPerformanceMap = new Map<string, WordPerformance>()
    
    // Initialize performance for all words
    words.forEach((word: string) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
      if (cleanWord && !wordPerformanceMap.has(cleanWord)) {
        const mastered = masteredWords?.find((m: any) => m.word === cleanWord)
        wordPerformanceMap.set(cleanWord, {
          word: cleanWord,
          correctCount: mastered?.times_spoken_correctly || 0,
          missedCount: mastered?.missed_count || 0,
          hesitatedCount: mastered?.hesitated_count || 0,
          isSimple: SIMPLE_WORDS.has(cleanWord),
          lastPerformance: 'none'
        })
      }
    })

    // Create sets for quick lookup
    const missedSet = new Set(missedWords.map((w: string) => w.toLowerCase().replace(/[^\w]/g, '')))
    const hesitatedSet = new Set(hesitatedWords.map((w: string) => w.toLowerCase().replace(/[^\w]/g, '')))

    // Update performance based on this session
    words.forEach((word: string) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
      const perf = wordPerformanceMap.get(cleanWord)
      if (!perf) return

      if (missedSet.has(cleanWord)) {
        perf.missedCount++
        perf.lastPerformance = 'missed'
      } else if (hesitatedSet.has(cleanWord)) {
        perf.hesitatedCount++
        perf.lastPerformance = 'hesitated'
      } else {
        // Word was spoken correctly this session
        perf.correctCount++
        perf.lastPerformance = 'correct'
      }
    })

    // Update mastered_words table with new performance data
    for (const [word, perf] of wordPerformanceMap.entries()) {
      await supabaseClient
        .from('mastered_words')
        .upsert({
          speech_id: speechId,
          word: word,
          times_spoken_correctly: perf.correctCount,
          missed_count: perf.missedCount,
          hesitated_count: perf.hesitatedCount,
          last_spoken_at: new Date().toISOString()
        }, {
          onConflict: 'speech_id,word'
        })
    }

    // Determine which words should be hidden
    const wordsToHide = new Set<number>()
    
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '')
      const perf = wordPerformanceMap.get(cleanWord)
      
      if (!perf || !cleanWord) return

      // RULE 1: If word was just missed or hesitated, ALWAYS keep it visible
      if (perf.lastPerformance === 'missed' || perf.lastPerformance === 'hesitated') {
        return // Keep visible
      }

      // RULE 2: If word has recent errors in history, keep visible
      if (perf.missedCount > 0 || perf.hesitatedCount > 0) {
        // Only hide if they've recovered with enough correct attempts
        const recentCorrects = perf.correctCount - (perf.missedCount + perf.hesitatedCount)
        if (recentCorrects < 2) {
          return // Keep visible until they prove recovery
        }
      }

      // RULE 3: Hide simple words first (after 2 correct attempts)
      if (perf.isSimple && perf.correctCount >= 2) {
        wordsToHide.add(index)
        return
      }

      // RULE 4: Hide harder words progressively (after 4 correct attempts)
      if (!perf.isSimple && perf.correctCount >= 4) {
        wordsToHide.add(index)
        return
      }
    })

    // Create text_current with brackets around hidden words
    const modifiedWords = words.map((word: string, index: number) => {
      if (wordsToHide.has(index)) {
        return `[${word}]`
      }
      return word
    })

    const textCurrent = modifiedWords.join(' ')
    const hiddenPercentage = Math.round((wordsToHide.size / words.length) * 100)

    console.log(`Hiding ${wordsToHide.size} of ${words.length} words (${hiddenPercentage}%)`)

    // Update the speech with new text_current
    const { error: updateError } = await supabaseClient
      .from('speeches')
      .update({ 
        text_current: textCurrent,
        base_word_visibility_percent: 100 - hiddenPercentage
      })
      .eq('id', speechId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ 
        success: true, 
        hiddenCount: wordsToHide.size,
        totalWords: words.length,
        hiddenPercentage,
        message: `Adapted hiding: ${wordsToHide.size}/${words.length} words hidden`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
