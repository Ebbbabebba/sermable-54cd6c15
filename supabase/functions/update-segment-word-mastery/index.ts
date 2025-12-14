import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple grammatical words that should be hidden first
const SIMPLE_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'nor', 'yet', 'so',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'down',
  'about', 'into', 'through', 'during', 'after', 'before', 'between', 'among',
  'under', 'over', 'above', 'below', 'across', 'along', 'around', 'behind',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  'this', 'that', 'these', 'those',
  'very', 'just', 'so', 'too', 'also', 'well', 'then', 'now', 'here', 'there',
  'as', 'if', 'than', 'when', 'where', 'who', 'what', 'which', 'how', 'why',
  'all', 'some', 'any', 'each', 'every', 'both', 'few', 'many', 'much', 'more', 'most',
  // Swedish common words
  'och', 'är', 'att', 'det', 'en', 'ett', 'av', 'för', 'på', 'med', 'som',
  'har', 'till', 'den', 'de', 'om', 'så', 'men', 'nu', 'kan', 'ska',
  'jag', 'du', 'han', 'hon', 'vi', 'ni', 'dem', 'sig', 'sin', 'sitt', 'sina',
  'var', 'inte', 'från', 'eller', 'när', 'hur', 'vad', 'vem', 'där', 'här'
])

interface WordMasteryData {
  word: string
  wordIndex: number
  correctCount: number
  missedCount: number
  hesitatedCount: number
  hiddenMissCount: number
  hiddenHesitateCount: number
  isAnchorKeyword: boolean
  isSimple: boolean
  wasHidden: boolean
}

interface PhraseData {
  phraseText: string
  startIndex: number
  endIndex: number
  timesCorrect: number
  timesMissed: number
  isHidden: boolean
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

    const { 
      speechId, 
      segmentId,
      missedWords = [], 
      hesitatedWords = [],
      missedIndices = [],
      hesitatedIndices = [],
      hiddenIndices = [] // Indices that were hidden during this session
    } = await req.json()

    if (!speechId) {
      throw new Error('Speech ID is required')
    }

    console.log('Processing segment word mastery for speech:', speechId)
    console.log('Segment:', segmentId)
    console.log('Missed indices:', missedIndices)
    console.log('Hesitated indices:', hesitatedIndices)
    console.log('Hidden indices:', hiddenIndices)

    // Get the speech and segment data
    const { data: speech, error: speechError } = await supabaseClient
      .from('speeches')
      .select('*')
      .eq('id', speechId)
      .single()

    if (speechError) throw speechError

    // Get segment if provided
    let segment = null
    if (segmentId) {
      const { data: segmentData } = await supabaseClient
        .from('speech_segments')
        .select('*')
        .eq('id', segmentId)
        .single()
      segment = segmentData
    }

    const words = speech.text_original.split(/\s+/).filter((w: string) => w.trim())
    const hiddenSet = new Set(hiddenIndices)
    const missedSet = new Set(missedIndices)
    const hesitatedSet = new Set(hesitatedIndices)

    // Get current mastery data
    const { data: masteredWords } = await supabaseClient
      .from('mastered_words')
      .select('*')
      .eq('speech_id', speechId)

    // Build word mastery map
    const wordMasteryMap = new Map<string, WordMasteryData>()
    
    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      if (!cleanWord) return

      const existing = masteredWords?.find((m: any) => m.word === cleanWord)
      const wasHidden = hiddenSet.has(index)
      const wasMissed = missedSet.has(index)
      const wasHesitated = hesitatedSet.has(index)

      let data = wordMasteryMap.get(cleanWord)
      if (!data) {
        data = {
          word: cleanWord,
          wordIndex: index,
          correctCount: existing?.times_spoken_correctly || 0,
          missedCount: existing?.missed_count || 0,
          hesitatedCount: existing?.hesitated_count || 0,
          hiddenMissCount: existing?.hidden_miss_count || 0,
          hiddenHesitateCount: existing?.hidden_hesitate_count || 0,
          isAnchorKeyword: existing?.is_anchor_keyword || false,
          isSimple: SIMPLE_WORDS.has(cleanWord),
          wasHidden
        }
        wordMasteryMap.set(cleanWord, data)
      }

      // Update counts based on this session
      if (wasMissed) {
        data.missedCount++
        if (wasHidden) {
          data.hiddenMissCount++
          // If missed while hidden 2+ times, mark as anchor keyword
          if (data.hiddenMissCount >= 2) {
            data.isAnchorKeyword = true
            console.log(`Word "${cleanWord}" marked as anchor keyword (hidden miss count: ${data.hiddenMissCount})`)
          }
        }
      } else if (wasHesitated) {
        data.hesitatedCount++
        if (wasHidden) {
          data.hiddenHesitateCount++
          // If hesitated while hidden 3+ times, mark as anchor keyword
          if (data.hiddenHesitateCount >= 3) {
            data.isAnchorKeyword = true
            console.log(`Word "${cleanWord}" marked as anchor keyword (hidden hesitate count: ${data.hiddenHesitateCount})`)
          }
        }
      } else {
        // Spoken correctly
        data.correctCount++
      }
    })

    // Update mastered_words table with enhanced tracking
    for (const [word, data] of wordMasteryMap.entries()) {
      await supabaseClient
        .from('mastered_words')
        .upsert({
          speech_id: speechId,
          word: word,
          times_spoken_correctly: data.correctCount,
          missed_count: data.missedCount,
          hesitated_count: data.hesitatedCount,
          hidden_miss_count: data.hiddenMissCount,
          hidden_hesitate_count: data.hiddenHesitateCount,
          is_anchor_keyword: data.isAnchorKeyword,
          last_spoken_at: new Date().toISOString()
        }, {
          onConflict: 'speech_id,word'
        })
    }

    // Calculate which words to hide based on new logic
    const wordsToHide = new Set<number>()
    const anchorKeywordIndices: number[] = []
    const candidatesToHide: Array<{ index: number; priority: number; isSimple: boolean }> = []

    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const data = wordMasteryMap.get(cleanWord)
      
      if (!data || !cleanWord) return

      // RULE 1: Anchor keywords NEVER get hidden - they stay visible as cue words
      if (data.isAnchorKeyword) {
        anchorKeywordIndices.push(index)
        return // Keep visible
      }

      // RULE 2: Words missed/hesitated while hidden should stay visible until proven
      if (data.hiddenMissCount > 0 || data.hiddenHesitateCount > 0) {
        // Need extra correct attempts to hide again
        const recoveryNeeded = (data.hiddenMissCount * 3) + (data.hiddenHesitateCount * 2)
        if (data.correctCount < recoveryNeeded) {
          return // Keep visible until recovered
        }
      }

      // RULE 3: Words with any recent errors stay visible
      if (data.missedCount > 0 || data.hesitatedCount > 0) {
        const recentCorrects = data.correctCount - (data.missedCount + data.hesitatedCount)
        if (recentCorrects < 2) {
          return // Keep visible
        }
      }

      // RULE 4: Simple words hide after 1 clean correct - track as candidate
      if (data.isSimple && data.correctCount >= 1 && data.missedCount === 0 && data.hesitatedCount === 0) {
        candidatesToHide.push({ index, priority: 1, isSimple: true })
        return
      }

      // RULE 5: Harder words need 3 clean corrects - track as candidate
      if (!data.isSimple && data.correctCount >= 3 && data.missedCount === 0 && data.hesitatedCount === 0) {
        candidatesToHide.push({ index, priority: 2, isSimple: false })
        return
      }
    })

    // GRADUAL HIDING: Only hide 1 word per session for smooth progression
    // Prioritize simple words first (priority 1), then harder words (priority 2)
    const MAX_NEW_WORDS_TO_HIDE_PER_SESSION = 1
    
    // Sort candidates: simple words first, then by index for consistency
    candidatesToHide.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.index - b.index
    })

    // Only take the first N candidates
    const newWordsToHide = candidatesToHide.slice(0, MAX_NEW_WORDS_TO_HIDE_PER_SESSION)
    newWordsToHide.forEach(candidate => wordsToHide.add(candidate.index))
    
    console.log(`Candidates to hide: ${candidatesToHide.length}, actually hiding ${newWordsToHide.length} new word(s)`)

    // Create text_current with brackets around hidden words
    const modifiedWords = words.map((word: string, index: number) => {
      if (wordsToHide.has(index)) {
        return `[${word}]`
      }
      return word
    })

    const textCurrent = modifiedWords.join(' ')
    const hiddenPercentage = Math.round((wordsToHide.size / words.length) * 100)
    const visibilityPercent = 100 - hiddenPercentage

    console.log(`Hiding ${wordsToHide.size} of ${words.length} words (${hiddenPercentage}%)`)
    console.log(`Anchor keywords: ${anchorKeywordIndices.length}`)

    // Update the speech with new text_current
    await supabaseClient
      .from('speeches')
      .update({ 
        text_current: textCurrent,
        base_word_visibility_percent: visibilityPercent
      })
      .eq('id', speechId)

    // Update segment visibility and anchor keywords if segment provided
    if (segmentId) {
      // Calculate segment-specific visibility
      const segmentStart = segment?.start_word_index || 0
      const segmentEnd = segment?.end_word_index || words.length - 1
      
      let segmentHiddenCount = 0
      const segmentAnchorKeywords: number[] = []
      
      for (let i = segmentStart; i <= segmentEnd; i++) {
        if (wordsToHide.has(i)) segmentHiddenCount++
        if (anchorKeywordIndices.includes(i)) segmentAnchorKeywords.push(i)
      }
      
      const segmentWordCount = segmentEnd - segmentStart + 1
      const segmentVisibility = Math.round(((segmentWordCount - segmentHiddenCount) / segmentWordCount) * 100)

      // Calculate next review time based on mastery
      let nextReviewMinutes = 60 // Default 1 hour
      if (segmentVisibility <= 20) {
        // Highly mastered - schedule further out
        nextReviewMinutes = 240 // 4 hours
      } else if (segmentVisibility <= 50) {
        nextReviewMinutes = 120 // 2 hours
      } else if (segmentVisibility <= 80) {
        nextReviewMinutes = 60 // 1 hour
      } else {
        nextReviewMinutes = 30 // 30 minutes - needs more practice
      }

      const nextReviewAt = new Date(Date.now() + nextReviewMinutes * 60 * 1000)

      await supabaseClient
        .from('speech_segments')
        .update({
          visibility_percent: segmentVisibility,
          anchor_keywords: segmentAnchorKeywords,
          next_review_at: nextReviewAt.toISOString(),
          times_practiced: (segment?.times_practiced || 0) + 1,
          is_mastered: segmentVisibility <= 20
        })
        .eq('id', segmentId)

      console.log(`Segment ${segmentId} visibility: ${segmentVisibility}%, next review: ${nextReviewAt.toISOString()}`)
    }

    // Generate/update phrase chunks
    await generatePhraseChunks(supabaseClient, speechId, words, wordMasteryMap)

    return new Response(
      JSON.stringify({ 
        success: true, 
        hiddenCount: wordsToHide.size,
        totalWords: words.length,
        visibilityPercent,
        anchorKeywordCount: anchorKeywordIndices.length,
        anchorKeywords: anchorKeywordIndices,
        message: `Segment mastery updated: ${visibilityPercent}% visible, ${anchorKeywordIndices.length} anchor keywords`
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

// Generate phrase chunks based on natural sentence structure
async function generatePhraseChunks(
  supabase: any, 
  speechId: string, 
  words: string[],
  wordMasteryMap: Map<string, WordMasteryData>
) {
  // Delete existing phrases for this speech
  await supabase
    .from('speech_phrases')
    .delete()
    .eq('speech_id', speechId)

  const phrases: PhraseData[] = []
  let currentPhraseStart = 0
  let currentPhraseWords: string[] = []

  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    currentPhraseWords.push(word)

    // Check if this is a phrase boundary (punctuation or 4-5 words)
    const hasPunctuation = /[.!?,;:]$/.test(word)
    const isLongEnough = currentPhraseWords.length >= 4
    const isMaxLength = currentPhraseWords.length >= 5

    if (hasPunctuation || isMaxLength || (isLongEnough && i === words.length - 1)) {
      // Calculate phrase difficulty based on word mastery
      let phraseTimesCorrect = 0
      let phraseTimesMissed = 0
      
      currentPhraseWords.forEach((w, idx) => {
        const cleanWord = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
        const data = wordMasteryMap.get(cleanWord)
        if (data) {
          phraseTimesCorrect += data.correctCount
          phraseTimesMissed += data.missedCount + data.hesitatedCount
        }
      })

      // Phrase is hidden if average word mastery is high enough
      const avgCorrect = phraseTimesCorrect / currentPhraseWords.length
      const avgMissed = phraseTimesMissed / currentPhraseWords.length
      const isHidden = avgCorrect >= 3 && avgMissed < 1

      phrases.push({
        phraseText: currentPhraseWords.join(' '),
        startIndex: currentPhraseStart,
        endIndex: i,
        timesCorrect: Math.round(avgCorrect),
        timesMissed: Math.round(avgMissed),
        isHidden
      })

      // Reset for next phrase
      currentPhraseStart = i + 1
      currentPhraseWords = []
    }
  }

  // Handle any remaining words
  if (currentPhraseWords.length > 0) {
    phrases.push({
      phraseText: currentPhraseWords.join(' '),
      startIndex: currentPhraseStart,
      endIndex: words.length - 1,
      timesCorrect: 0,
      timesMissed: 0,
      isHidden: false
    })
  }

  // Insert all phrases
  if (phrases.length > 0) {
    await supabase
      .from('speech_phrases')
      .insert(phrases.map(p => ({
        speech_id: speechId,
        phrase_text: p.phraseText,
        start_word_index: p.startIndex,
        end_word_index: p.endIndex,
        times_correct: p.timesCorrect,
        times_missed: p.timesMissed,
        is_hidden: p.isHidden
      })))
  }

  console.log(`Generated ${phrases.length} phrase chunks`)
}
