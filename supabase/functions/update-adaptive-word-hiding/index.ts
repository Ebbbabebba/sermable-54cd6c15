import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ONLY true junk/filler words that can be hidden first
const SIMPLE_WORDS = new Set([
  // English conjunctions and short prepositions ONLY
  'and', 'or', 'but', 'so', 'yet', 'nor',
  'in', 'on', 'at', 'to', 'of', 'by', 'for',
  'a', 'an', 'the',
  'is', 'are', 'was', 'were', 'be',
  'it', 'its',
  // Swedish equivalents
  'och', 'eller', 'men', 'så',
  'i', 'på', 'av', 'för', 'till', 'med',
  'en', 'ett', 'den', 'det',
  'är', 'var'
])

// Words that should be hidden LAST - content words, unique words, hard words
const isContentWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  
  // Words longer than 5 characters are content words
  if (cleanWord.length > 5) return true
  
  // Words with special characters (like ä, ö, å in Swedish)
  if (/[äöåéèêëàáâãüïîôûùúñçšž]/i.test(cleanWord)) return true
  
  // Capitalized words (proper nouns, start of sentences)
  if (/^[A-ZÄÖÅÉÈÊËÀÁÂÃÜÏÎÔÛÙÚÑÇŠŽ]/.test(word)) return true
  
  // Words with numbers
  if (/\d/.test(word)) return true
  
  return false
}

interface WordPerformance {
  word: string;
  correctCount: number;
  missedCount: number;
  hesitatedCount: number;
  isSimple: boolean;
  isSentenceEnding: boolean;
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
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      if (cleanWord && !wordPerformanceMap.has(cleanWord)) {
        const mastered = masteredWords?.find((m: any) => m.word === cleanWord)
        const isContent = isContentWord(word)
        const endsWithPunctuation = /[.!?]$/.test(word.trim())
        wordPerformanceMap.set(cleanWord, {
          word: cleanWord,
          correctCount: mastered?.times_spoken_correctly || 0,
          missedCount: mastered?.missed_count || 0,
          hesitatedCount: mastered?.hesitated_count || 0,
          isSimple: SIMPLE_WORDS.has(cleanWord) && !isContent && !endsWithPunctuation,
          isSentenceEnding: endsWithPunctuation,
          lastPerformance: 'none'
        })
      }
    })

    // Create sets for quick lookup
    const missedSet = new Set(missedWords.map((w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))
    const hesitatedSet = new Set(hesitatedWords.map((w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')))

    // Update performance based on this session
    words.forEach((word: string) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
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
    // Priority: simple words first, then hard words + sentence-ending words LAST
    const wordsToHide = new Set<number>()
    
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
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

      // Check if this is a hard word or sentence-ending word
      const isHardWord = isContentWord(word)
      const isSentenceEnding = /[.!?]$/.test(word.trim())

      // RULE 3: Hide simple grammatical words first (after 1 correct attempt)
      // These are words like "and", "or", "is", "a" - very easy to recall
      if (perf.isSimple && !isSentenceEnding && perf.correctCount >= 1 && perf.missedCount === 0 && perf.hesitatedCount === 0) {
        wordsToHide.add(index)
        return
      }

      // RULE 4: Hide hard words + sentence-ending words LAST (after 5+ correct attempts)
      // These disappear together as the "hardest" words based on performance
      if ((isHardWord || isSentenceEnding) && perf.correctCount >= 5 && perf.missedCount === 0 && perf.hesitatedCount === 0) {
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
