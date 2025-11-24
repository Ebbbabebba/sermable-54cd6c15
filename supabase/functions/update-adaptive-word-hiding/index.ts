import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Common simple grammatical words to hide first (articles, prepositions, conjunctions, auxiliary verbs)
const SIMPLE_WORDS = new Set([
  // Articles
  'the', 'a', 'an',
  // Conjunctions
  'and', 'or', 'but', 'nor', 'yet', 'so',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'down',
  'about', 'into', 'through', 'during', 'after', 'before', 'between', 'among',
  'under', 'over', 'above', 'below', 'across', 'along', 'around', 'behind',
  // Auxiliary verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  // Pronouns
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those',
  // Common adverbs
  'very', 'just', 'so', 'too', 'also', 'well', 'then', 'now', 'here', 'there',
  // Other common words
  'as', 'if', 'than', 'when', 'where', 'who', 'what', 'which', 'how', 'why',
  'all', 'some', 'any', 'each', 'every', 'both', 'few', 'many', 'much', 'more', 'most'
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

      // RULE 3: Hide simple grammatical words first (after just 1 correct attempt)
      // These are words like "the", "and", "or", "is", "a" - very easy to recall
      if (perf.isSimple && perf.correctCount >= 1 && perf.missedCount === 0 && perf.hesitatedCount === 0) {
        wordsToHide.add(index)
        return
      }

      // RULE 4: Hide harder words progressively (after 3 correct attempts without errors)
      if (!perf.isSimple && perf.correctCount >= 3 && perf.missedCount === 0 && perf.hesitatedCount === 0) {
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
