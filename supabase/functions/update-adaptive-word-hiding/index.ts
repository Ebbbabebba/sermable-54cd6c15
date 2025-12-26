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
    // ULTRA-AGGRESSIVE SPACED REPETITION v4:
    // FAS 1: Dölj ALLA småord DIREKT efter första försöket (oavsett resultat)
    // FAS 2: Efter 80%+ accuracy (småord borta), slumpmässigt dölj fler ord
    // FAS 3: AI analyserar vilka ord som ska visas/döljas baserat på prestation
    // Om småord missas kan de komma tillbaka, men testas snart igen
    
    const wordsToHide = new Set<number>()
    const wordsToKeepVisible = new Set<number>()
    
    // Utökad lista med småord - dessa döljs ALLTID efter första försöket
    const allSmallWords = new Set([
      // Svenska småord
      'och', 'att', 'i', 'en', 'ett', 'av', 'på', 'för', 'med', 'som',
      'är', 'var', 'den', 'det', 'de', 'om', 'till', 'från', 'har', 'vi',
      'jag', 'du', 'han', 'hon', 'ni', 'kan', 'ska', 'vill', 'måste', 'får',
      'men', 'eller', 'så', 'när', 'där', 'här', 'inte', 'bara', 'även', 'också',
      'nu', 'då', 'ju', 'nog', 'väl', 'ändå', 'redan', 'sedan', 'efter', 'innan',
      'under', 'över', 'vid', 'hos', 'mot', 'utan', 'genom', 'mellan', 'ur', 'åt',
      'alla', 'allt', 'andra', 'denna', 'detta', 'dessa', 'vilken', 'vilket', 'vilka',
      'min', 'din', 'sin', 'vår', 'er', 'deras', 'mitt', 'ditt', 'sitt', 'vårt', 'ert',
      // Engelska småord
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'it', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its',
      'we', 'they', 'you', 'i', 'he', 'she', 'not', 'just', 'also', 'very',
      'if', 'so', 'as', 'up', 'out', 'no', 'yes', 'all', 'any', 'some',
      'our', 'their', 'who', 'what', 'when', 'where', 'why', 'how', 'which'
    ])
    
    // Beräkna accuracy på icke-småord för att avgöra fas
    let nonSmallWordsCorrect = 0
    let nonSmallWordsTotal = 0
    
    words.forEach((word: string) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      if (!cleanWord) return
      
      const isSmall = allSmallWords.has(cleanWord) || cleanWord.length <= 2
      if (!isSmall && cleanWord.length > 3) {
        nonSmallWordsTotal++
        if (!missedSet.has(cleanWord)) {
          nonSmallWordsCorrect++
        }
      }
    })
    
    const nonSmallAccuracy = nonSmallWordsTotal > 0 
      ? (nonSmallWordsCorrect / nonSmallWordsTotal) * 100 
      : 100
    
    const hasAchieved80Percent = nonSmallAccuracy >= 80
    
    console.log(`📈 Non-small words accuracy: ${nonSmallAccuracy.toFixed(1)}%, achieved 80%+: ${hasAchieved80Percent}`)
    
    // Process each word
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const perf = wordPerformanceMap.get(cleanWord)
      
      if (!perf || !cleanWord) return

      const isSmallWord = allSmallWords.has(cleanWord) || cleanWord.length <= 2
      
      // === FAS 1: SMÅORD - Dölj ALLTID DIREKT efter första övningen ===
      // Småord döljs ALLTID oavsett resultat - detta är kärnan i spaced repetition
      // Endast undantag: om missat 3+ gånger OCH 0 consecutive correct (persistent problem)
      if (isSmallWord) {
        const totalAttempts = perf.correctCount + perf.missedCount + perf.hesitatedCount
        
        // Om detta är första övningen (vi har nu minst 1 attempt) - ALLTID dölj
        if (totalAttempts >= 1) {
          // Enda undantaget: persistent problem (3+ miss, aldrig klarat)
          if (perf.missedCount >= 3 && perf.consecutiveCorrect === 0) {
            wordsToKeepVisible.add(index)
            console.log(`⚠️ Keeping persistent problem small word: "${cleanWord}" (${perf.missedCount} misses)`)
          } else {
            // DÖLJ ALLTID småord efter första övningen
            wordsToHide.add(index)
            console.log(`🚫 IMMEDIATE hide small word after first practice: "${cleanWord}"`)
          }
        } else {
          // Inte övat än - dölj ändå proaktivt för småord
          wordsToHide.add(index)
          console.log(`🚫 Proactive hide unpracticed small word: "${cleanWord}"`)
        }
        return
      }
      
      // === FAS 2: Efter 80%+ accuracy, slumpmässigt dölj fler ord ===
      if (hasAchieved80Percent) {
        if (perf.lastPerformance === 'missed') {
          // Missade ord i denna session
          if (perf.missedCount >= 3 && perf.consecutiveCorrect === 0) {
            // Persistent problem - behåll synligt
            wordsToKeepVisible.add(index)
            console.log(`👁️ Keeping (persistent miss): "${cleanWord}"`)
          } else {
            // Slumpmässigt: 60% chans att döljas för att testa recall
            if (Math.random() < 0.6) {
              wordsToHide.add(index)
              console.log(`🎲 Random hide missed word (testing): "${cleanWord}"`)
            } else {
              wordsToKeepVisible.add(index)
            }
          }
        } else if (perf.lastPerformance === 'hesitated') {
          // Tvekade ord - 75% chans att döljas
          if (Math.random() < 0.75) {
            wordsToHide.add(index)
            console.log(`🎲 Random hide hesitated word: "${cleanWord}"`)
          } else {
            wordsToKeepVisible.add(index)
          }
        } else {
          // Korrekta ord - 90% chans att döljas
          if (Math.random() < 0.9) {
            wordsToHide.add(index)
            console.log(`🎲 Random hide correct word: "${cleanWord}"`)
          } else {
            wordsToKeepVisible.add(index)
          }
        }
        return
      }
      
      // === FAS 3: Under 80% - fortfarande aggressiv men lite försiktigare ===
      if (perf.lastPerformance === 'missed') {
        // Missade ord - behåll endast om persistent problem
        if (perf.missedCount >= 2 && perf.consecutiveCorrect === 0) {
          wordsToKeepVisible.add(index)
          console.log(`👁️ Keeping (missed ${perf.missedCount}x): "${cleanWord}"`)
        } else {
          // Dölj för att tvinga recall-test
          wordsToHide.add(index)
          console.log(`🧪 Hiding after miss (testing recall): "${cleanWord}"`)
        }
      } else if (perf.lastPerformance === 'hesitated') {
        // Tvekade ord - dölj för att tvinga recall
        wordsToHide.add(index)
        console.log(`🧪 Hiding hesitated word: "${cleanWord}"`)
      } else if (perf.lastPerformance === 'correct') {
        // Korrekta ord - dölj omedelbart
        wordsToHide.add(index)
        console.log(`✅ Hiding correct word: "${cleanWord}"`)
      } else {
        // Ej testat ord - dölj proaktivt (vartannat ord)
        if (index % 2 === 0) {
          wordsToHide.add(index)
          console.log(`🔢 Proactive hide (pattern): "${cleanWord}"`)
        }
      }
      
      // AI: Testa även svåra ord för att analysera mönster
      if (difficultWords.has(cleanWord) && !wordsToKeepVisible.has(index)) {
        // Endast behåll svåra ord om de missats 3+ gånger utan återhämtning
        if (perf.missedCount >= 3 && perf.consecutiveCorrect === 0) {
          wordsToKeepVisible.add(index)
          wordsToHide.delete(index)
          console.log(`⚠️ Keeping difficult word (needs practice): "${cleanWord}"`)
        } else {
          wordsToHide.add(index)
          console.log(`🧪 Testing difficult word: "${cleanWord}"`)
        }
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
