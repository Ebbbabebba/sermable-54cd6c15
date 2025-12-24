import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ONLY true junk/filler words that can be hidden IMMEDIATELY
const SIMPLE_WORDS = new Set([
  // English conjunctions and short prepositions ONLY
  'and', 'or', 'but', 'so', 'yet', 'nor',
  'in', 'on', 'at', 'to', 'of', 'by', 'for',
  'a', 'an', 'the',
  'is', 'are', 'was', 'were', 'be',
  'it', 'its', 'this', 'that',
  // Swedish equivalents
  'och', 'eller', 'men', 'så', 'som', 'att',
  'i', 'på', 'av', 'för', 'till', 'med', 'om',
  'en', 'ett', 'den', 'det', 'de',
  'är', 'var', 'har', 'kan', 'ska', 'vill',
  'jag', 'du', 'vi', 'ni', 'han', 'hon'
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

// Calculate difficulty score for a word based on historical performance
const calculateDifficultyScore = (perf: WordPerformance): number => {
  const totalAttempts = perf.correctCount + perf.missedCount + perf.hesitatedCount
  if (totalAttempts === 0) return 0
  
  // Higher score = more difficult word
  const errorRate = (perf.missedCount * 2 + perf.hesitatedCount) / totalAttempts
  const recentErrorBonus = perf.lastPerformance === 'missed' ? 0.5 : 
                           perf.lastPerformance === 'hesitated' ? 0.3 : 0
  const consecutiveErrorBonus = perf.consecutiveErrors * 0.2
  
  return errorRate + recentErrorBonus + consecutiveErrorBonus
}

interface WordPerformance {
  word: string;
  correctCount: number;
  missedCount: number;
  hesitatedCount: number;
  consecutiveCorrect: number;
  consecutiveErrors: number;
  isSimple: boolean;
  isSentenceEnding: boolean;
  lastPerformance: 'correct' | 'missed' | 'hesitated' | 'none';
  difficultyScore: number;
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
          consecutiveCorrect: mastered?.consecutive_sessions_correct || 0,
          consecutiveErrors: 0, // Will be calculated
          isSimple: SIMPLE_WORDS.has(cleanWord) && !isContent && !endsWithPunctuation,
          isSentenceEnding: endsWithPunctuation,
          lastPerformance: 'none',
          difficultyScore: 0
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
        perf.consecutiveErrors++
        perf.consecutiveCorrect = 0
      } else if (hesitatedSet.has(cleanWord)) {
        perf.hesitatedCount++
        perf.lastPerformance = 'hesitated'
        perf.consecutiveErrors++
        perf.consecutiveCorrect = 0
      } else {
        // Word was spoken correctly this session
        perf.correctCount++
        perf.lastPerformance = 'correct'
        perf.consecutiveCorrect++
        perf.consecutiveErrors = 0
      }
      
      // Calculate difficulty score for AI analysis
      perf.difficultyScore = calculateDifficultyScore(perf)
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
          consecutive_sessions_correct: perf.consecutiveCorrect,
          last_spoken_at: new Date().toISOString()
        }, {
          onConflict: 'speech_id,word'
        })
    }

    // AI ANALYSIS: Identify difficult words based on patterns
    const difficultWords = new Set<string>()
    const recoveredWords = new Set<string>()
    
    for (const [word, perf] of wordPerformanceMap.entries()) {
      // Word is difficult if:
      // 1. High difficulty score (>0.5) based on error patterns
      // 2. Has been missed/hesitated multiple times
      // 3. Error rate > 30% of attempts
      const totalAttempts = perf.correctCount + perf.missedCount + perf.hesitatedCount
      const errorRate = totalAttempts > 0 ? (perf.missedCount + perf.hesitatedCount) / totalAttempts : 0
      
      if (perf.difficultyScore > 0.5 || errorRate > 0.3 || (perf.missedCount + perf.hesitatedCount) >= 2) {
        difficultWords.add(word)
        console.log(`🔴 AI identified difficult word: "${word}" (score: ${perf.difficultyScore.toFixed(2)}, errorRate: ${(errorRate * 100).toFixed(0)}%)`)
      }
      
      // Word has recovered if:
      // 1. Was previously difficult but now has 2+ consecutive correct
      // 2. Recent correct attempts outweigh errors
      if (perf.consecutiveCorrect >= 2 && perf.correctCount > (perf.missedCount + perf.hesitatedCount)) {
        recoveredWords.add(word)
        difficultWords.delete(word) // Remove from difficult if recovered
        console.log(`🟢 AI: Word recovered: "${word}" (${perf.consecutiveCorrect} consecutive correct)`)
      }
    }

    // Determine which words should be hidden
    // ULTRA-AGGRESSIVE SPACED REPETITION v3: 
    // - Hide MANY words from session 1 to force active recall
    // - Test user on difficult words too (don't keep them visible forever)
    // - Only keep truly problematic words (missed THIS session) visible
    // Goal: Most words should be hidden FAST so brain works harder = faster learning
    const wordsToHide = new Set<number>()
    const wordsToKeepVisible = new Set<number>()
    
    // Count how many sessions total for this speech
    const sessionCounts = Array.from(wordPerformanceMap.values())
      .map(p => p.correctCount + p.missedCount + p.hesitatedCount)
    const maxSessionCount = Math.max(...sessionCounts, 1)
    const isFirstSession = maxSessionCount <= 1
    
    console.log(`📈 Session count: ${maxSessionCount}, First session: ${isFirstSession}`)
    
    // First pass: Identify words that MUST stay visible (only words missed THIS session)
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const perf = wordPerformanceMap.get(cleanWord)
      
      if (!perf || !cleanWord) return

      // ONLY keep visible if MISSED in THIS session (not hesitated, not historical)
      // This is STRICT - we want to test the user on almost everything
      if (perf.lastPerformance === 'missed') {
        wordsToKeepVisible.add(index)
        console.log(`👁️ Keeping visible (missed NOW): "${cleanWord}"`)
      }
    })
    
    // Second pass: Everything else gets hidden (including difficult words!)
    // Spaced repetition principle: TEST the user on hard words to analyze patterns
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const perf = wordPerformanceMap.get(cleanWord)
      
      if (!perf || !cleanWord) return
      
      // If marked to keep visible, skip
      if (wordsToKeepVisible.has(index)) return
      
      // === AGGRESSIVE HIDING - almost everything gets hidden ===
      
      // SIMPLE WORDS: Always hide after first session
      if (perf.isSimple) {
        wordsToHide.add(index)
        return
      }
      
      // FIRST SESSION: Hide 60-70% of words proactively to force recall
      // Include difficult words to TEST the user and see what they struggle with
      if (isFirstSession) {
        // Hide words that were correct OR hesitated (test recall on hesitations!)
        if (perf.lastPerformance === 'correct' || perf.lastPerformance === 'hesitated') {
          wordsToHide.add(index)
          return
        }
        // Proactively hide some untested words too - use index pattern
        // Hide every 2nd/3rd word that wasn't explicitly needed
        if (index % 2 === 0) {
          wordsToHide.add(index)
          return
        }
      }
      
      // SUBSEQUENT SESSIONS: Be even more aggressive
      // Hide everything that wasn't missed this session
      if (!isFirstSession) {
        // Any word that has been attempted gets hidden
        const totalAttempts = perf.correctCount + perf.missedCount + perf.hesitatedCount
        if (totalAttempts >= 1) {
          wordsToHide.add(index)
          return
        }
        // Untested words: hide most of them too (proactive challenge)
        if (index % 3 !== 0) { // Keep only every 3rd untested word
          wordsToHide.add(index)
          return
        }
      }
      
      // DIFFICULT WORDS: Still hide them! This is key to spaced repetition.
      // By hiding difficult words, we TEST whether user really struggles
      // If they fail, the word becomes visible again next session
      if (difficultWords.has(cleanWord)) {
        // Give difficult words ONE extra chance to stay visible
        // But only if they were missed multiple times recently
        if (perf.missedCount >= 3 && perf.consecutiveCorrect === 0) {
          console.log(`⚠️ Keeping difficult word visible for recovery: "${cleanWord}"`)
          return // Keep this one visible
        }
        // Otherwise, hide it to test the user!
        wordsToHide.add(index)
        console.log(`🧪 Hiding difficult word to TEST: "${cleanWord}"`)
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

    console.log(`📊 Hiding ${wordsToHide.size} of ${words.length} words (${hiddenPercentage}%)`)
    console.log(`🔴 Difficult words (kept visible): ${difficultWords.size}`)
    console.log(`🟢 Recovered words: ${recoveredWords.size}`)

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
        difficultWordsCount: difficultWords.size,
        difficultWords: Array.from(difficultWords),
        recoveredWordsCount: recoveredWords.size,
        message: `Adapted hiding: ${wordsToHide.size}/${words.length} words hidden, ${difficultWords.size} difficult words kept visible`
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
