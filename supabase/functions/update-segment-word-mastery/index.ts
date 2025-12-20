import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ONLY true junk/filler words that can be hidden - very restrictive
// These are words that add no semantic meaning and are easy to fill in
const SIMPLE_WORDS = new Set([
  // English conjunctions and short prepositions ONLY
  'and', 'or', 'but', 'so', 'yet', 'nor',
  'in', 'on', 'at', 'to', 'of', 'by', 'for',
  'a', 'an', 'the',
  'is', 'are', 'was', 'were', 'be',
  'it', 'its',
  // Swedish equivalents - conjunctions, prepositions, articles
  'och', 'eller', 'men', 'så', 'om', 'att', 'som',
  'i', 'på', 'av', 'för', 'till', 'med', 'hos', 'vid', 'under', 'över',
  'en', 'ett', 'den', 'det', 'de',
  'är', 'var', 'ha', 'har', 'hade',
  // Swedish pronouns
  'jag', 'du', 'vi', 'ni', 'han', 'hon', 'hen', 'dem',
  'mig', 'dig', 'sig', 'oss', 'er',
  'min', 'din', 'sin', 'vår',
  'mitt', 'ditt', 'sitt', 'vårt',
  'mina', 'dina', 'sina', 'våra',
  // Common short Swedish words
  'kan', 'ska', 'vill', 'måste', 'får',
  'nu', 'här', 'där', 'ut', 'in', 'upp', 'ner',
  'inte', 'nog', 'bara', 'också', 'ju'
])

// Words that should NEVER be hidden - content words, unique words, hard words
const isContentWord = (word: string): boolean => {
  const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  
  // Never hide words longer than 5 characters (they're likely content words)
  if (cleanWord.length > 5) return true
  
  // Never hide words with special characters (like ä, ö, å in Swedish)
  if (/[äöåéèêëàáâãüïîôûùúñçšž]/i.test(cleanWord)) return true
  
  // Never hide capitalized words (proper nouns, start of sentences)
  if (/^[A-ZÄÖÅÉÈÊËÀÁÂÃÜÏÎÔÛÙÚÑÇŠŽ]/.test(word)) return true
  
  // Never hide words with numbers
  if (/\d/.test(word)) return true
  
  return false
}

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
  isSentenceEnding: boolean
  wasHidden: boolean
  lastPerformance: 'correct' | 'missed' | 'hesitated' | 'none'
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

    // Get existing phrases for chunk-based recall
    const { data: existingPhrases } = await supabaseClient
      .from('speech_phrases')
      .select('*')
      .eq('speech_id', speechId)
      .order('start_word_index', { ascending: true })

    // Get practice session count for this speech (for progressive hiding scaling)
    const { count: sessionCount } = await supabaseClient
      .from('practice_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('speech_id', speechId)
    
    const totalSessions = sessionCount || 0
    console.log(`Total practice sessions for speech: ${totalSessions}`)

    // Parse existing text_current to find already-hidden words
    const currentText = speech.text_current || speech.text_original
    const alreadyHiddenIndices = new Set<number>()
    let wordIndex = 0
    const currentWords = currentText.split(/\s+/).filter((w: string) => w.trim())
    currentWords.forEach((word: string) => {
      // Check if word is wrapped in brackets [word]
      if (word.startsWith('[') && word.endsWith(']')) {
        alreadyHiddenIndices.add(wordIndex)
      }
      wordIndex++
    })
    console.log(`Already hidden word indices: ${Array.from(alreadyHiddenIndices).join(', ')}`)

    // CHUNK-BASED RECALL: Find phrases that contain missed words
    // and mark entire phrase for unhiding
    const phrasesNeedingRecovery = new Set<string>() // phrase IDs
    const phraseRecoveryIndices = new Set<number>() // word indices to keep visible
    
    if (existingPhrases && existingPhrases.length > 0) {
      missedIndices.forEach((missedIdx: number) => {
        const phrase = existingPhrases.find((p: any) => 
          missedIdx >= p.start_word_index && missedIdx <= p.end_word_index
        )
        if (phrase) {
          phrasesNeedingRecovery.add(phrase.id)
          // Mark ALL words in this phrase as needing visibility
          for (let i = phrase.start_word_index; i <= phrase.end_word_index; i++) {
            phraseRecoveryIndices.add(i)
          }
          console.log(`📦 Phrase "${phrase.phrase_text}" needs recovery (missed word at index ${missedIdx})`)
        }
      })
      
      // Also check hesitated words - they also trigger phrase recovery (but less aggressively)
      hesitatedIndices.forEach((hesIdx: number) => {
        const phrase = existingPhrases.find((p: any) => 
          hesIdx >= p.start_word_index && hesIdx <= p.end_word_index
        )
        if (phrase && !phrasesNeedingRecovery.has(phrase.id)) {
          // Only add if phrase already has high times_missed (pattern of struggle)
          if (phrase.times_missed >= 1) {
            phrasesNeedingRecovery.add(phrase.id)
            for (let i = phrase.start_word_index; i <= phrase.end_word_index; i++) {
              phraseRecoveryIndices.add(i)
            }
            console.log(`📦 Phrase "${phrase.phrase_text}" needs recovery (hesitation at index ${hesIdx}, already struggled)`)
          }
        }
      })
      
      console.log(`🔄 ${phrasesNeedingRecovery.size} phrases need recovery, affecting ${phraseRecoveryIndices.size} words`)
    }

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
        // Check if this is a content word that should never be hidden
        const isContent = isContentWord(word)
        // Check if word ends with sentence punctuation
        const endsWithPunctuation = /[.!?]$/.test(word.trim())
        
        data = {
          word: cleanWord,
          wordIndex: index,
          correctCount: existing?.times_spoken_correctly || 0,
          missedCount: existing?.missed_count || 0,
          hesitatedCount: existing?.hesitated_count || 0,
          hiddenMissCount: existing?.hidden_miss_count || 0,
          hiddenHesitateCount: existing?.hidden_hesitate_count || 0,
          isAnchorKeyword: existing?.is_anchor_keyword || false,
          // Only mark as simple if it's in SIMPLE_WORDS AND not a content word AND not sentence-ending
          isSimple: SIMPLE_WORDS.has(cleanWord) && !isContent && !endsWithPunctuation,
          isSentenceEnding: endsWithPunctuation,
          wasHidden,
          lastPerformance: 'none'
        }
        wordMasteryMap.set(cleanWord, data)
      }

      // Get existing consecutive correct count
      const existingWord = masteredWords?.find((m: any) => m.word === cleanWord)
      let consecutiveCorrect = existingWord?.consecutive_sessions_correct || 0

      // Update counts based on this session
      if (wasMissed) {
        data.missedCount++
        consecutiveCorrect = 0 // Reset consecutive correct on any miss
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
        consecutiveCorrect = 0 // Reset consecutive correct on hesitation
        if (wasHidden) {
          data.hiddenHesitateCount++
          // If hesitated while hidden 3+ times, mark as anchor keyword
          if (data.hiddenHesitateCount >= 3) {
            data.isAnchorKeyword = true
            console.log(`Word "${cleanWord}" marked as anchor keyword (hidden hesitate count: ${data.hiddenHesitateCount})`)
          }
        }
      } else {
        // Spoken correctly - increment consecutive correct
        data.correctCount++
        consecutiveCorrect++
      }
      
      // Store consecutive correct in the data for later use
      ;(data as any).consecutiveCorrect = consecutiveCorrect
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
          consecutive_sessions_correct: (data as any).consecutiveCorrect || 0,
          last_spoken_at: new Date().toISOString()
        }, {
          onConflict: 'speech_id,word'
        })
    }

    // Calculate which words to hide based on new logic
    const wordsToHide = new Set<number>()
    const anchorKeywordIndices: number[] = []
    const candidatesToHide: Array<{ index: number; priority: number; isSimple: boolean }> = []

    // FIRST: Preserve all already-hidden words (from previous sessions)
    // BUT: Un-hide words that are in phrases needing recovery (CHUNK-BASED RECALL)
    alreadyHiddenIndices.forEach(idx => {
      const word = words[idx]
      if (!word) return
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const data = wordMasteryMap.get(cleanWord)
      
      // CHUNK-BASED: If this word is in a phrase that needs recovery, unhide it
      if (phraseRecoveryIndices.has(idx)) {
        console.log(`📦 Un-hiding word "${cleanWord}" (part of phrase needing recovery)`)
        return // Don't add to wordsToHide - word will become visible
      }
      
      // Only un-hide if word was missed/hesitated while hidden (needs recovery)
      if (data && (data.hiddenMissCount > 0 || data.hiddenHesitateCount > 0)) {
        const recoveryNeeded = (data.hiddenMissCount * 3) + (data.hiddenHesitateCount * 2)
        if (data.correctCount < recoveryNeeded) {
          console.log(`Un-hiding word "${cleanWord}" - needs recovery (${data.correctCount}/${recoveryNeeded} correct)`)
          return // Don't add to wordsToHide - word will become visible
        }
      }
      
      // Keep the word hidden
      wordsToHide.add(idx)
    })
    
    console.log(`Preserving ${wordsToHide.size} already-hidden words from previous sessions`)
    console.log(`📦 Phrase recovery forced ${phraseRecoveryIndices.size} words visible`)

    words.forEach((word: string, index: number) => {
      const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
      const data = wordMasteryMap.get(cleanWord)
      
      if (!data || !cleanWord) return
      
      // Skip if already in wordsToHide (preserved from previous session)
      if (wordsToHide.has(index)) return

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
      
      const consecutiveCorrect = (data as any).consecutiveCorrect || 0
      
      // Check if this is a content word or sentence-ending word (these hide LAST)
      const isHardWord = isContentWord(word)
      const isSentenceEnding = /[.!?]$/.test(word.trim())

      // RULE 4: Simple/junk words - hide FIRST (priority 1)
      // Need 2 consecutive correct sessions
      if (data.isSimple && !isSentenceEnding && consecutiveCorrect >= 2 && data.missedCount === 0 && data.hesitatedCount === 0) {
        candidatesToHide.push({ index, priority: 1, isSimple: true })
        console.log(`Simple word "${word}" eligible for hiding (priority 1, ${consecutiveCorrect} consecutive correct)`)
        return
      }

      // RULE 4.5: Medium-difficulty words (not simple, not content-heavy, not sentence-ending)
      // These are regular words that should hide after 3 consecutive correct sessions
      // Priority 2 - they hide AFTER simple words but BEFORE hard words
      if (!data.isSimple && !isHardWord && !isSentenceEnding && consecutiveCorrect >= 3 && data.missedCount === 0 && data.hesitatedCount === 0) {
        candidatesToHide.push({ index, priority: 2, isSimple: false })
        console.log(`Medium word "${word}" eligible for hiding (priority 2, ${consecutiveCorrect} consecutive correct)`)
        return
      }

      // RULE 5: Sentence-ending words AND hard content words - hide LAST (priority 3)
      // These are the hardest words that disappear together at the very end
      // Need 5+ consecutive correct sessions with no errors
      if ((isSentenceEnding || isHardWord) && consecutiveCorrect >= 5 && data.missedCount === 0 && data.hesitatedCount === 0) {
        candidatesToHide.push({ index, priority: 3, isSimple: false })
        console.log(`Hard word "${word}" eligible for hiding (priority 3, ${consecutiveCorrect} consecutive correct)`)
        return
      }
    })

    // PROGRESSIVE HIDING SPEED based on session count
    // Sessions 1-10: 1 word per session (VERY gentle start - only junk words)
    // Sessions 11-20: 2 words per session (slightly faster)
    // Sessions 21+: 3 words per session (but still only junk words, cap at 3% of total)
    let maxNewWordsToHide = 1
    if (totalSessions >= 21) {
      maxNewWordsToHide = Math.min(3, Math.ceil(words.length * 0.03))
    } else if (totalSessions >= 11) {
      maxNewWordsToHide = 2
    }
    // Ensure we always hide at least 1 if there are candidates
    maxNewWordsToHide = Math.max(1, maxNewWordsToHide)
    
    console.log(`Session ${totalSessions + 1}: Max new words to hide = ${maxNewWordsToHide}`)
    
    // Sort candidates: simple words first, then by index for consistency
    candidatesToHide.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.index - b.index
    })

    // Only take the first N candidates for NEW hiding
    const newWordsToHide = candidatesToHide.slice(0, maxNewWordsToHide)
    newWordsToHide.forEach(candidate => wordsToHide.add(candidate.index))
    
    console.log(`Candidates to hide: ${candidatesToHide.length}, actually hiding ${newWordsToHide.length} NEW word(s)`)
    console.log(`Total hidden words: ${wordsToHide.size} (${alreadyHiddenIndices.size} preserved + ${newWordsToHide.length} new)`)

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

    // Update phrase chunks with recovery tracking (CHUNK-BASED RECALL)
    await updatePhraseChunks(supabaseClient, speechId, words, wordMasteryMap, existingPhrases, phrasesNeedingRecovery, missedIndices, hesitatedIndices)

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

// Update phrase chunks with chunk-based recovery tracking
async function updatePhraseChunks(
  supabase: any, 
  speechId: string, 
  words: string[],
  wordMasteryMap: Map<string, WordMasteryData>,
  existingPhrases: any[] | null,
  phrasesNeedingRecovery: Set<string>,
  missedIndices: number[],
  hesitatedIndices: number[]
) {
  // If no existing phrases, generate them first
  if (!existingPhrases || existingPhrases.length === 0) {
    console.log('📦 No existing phrases, generating initial phrase chunks...')
    
    const phrases: PhraseData[] = []
    let currentPhraseStart = 0
    let currentPhraseWords: string[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      currentPhraseWords.push(word)

      const hasPunctuation = /[.!?,;:]$/.test(word)
      const isLongEnough = currentPhraseWords.length >= 4
      const isMaxLength = currentPhraseWords.length >= 5

      if (hasPunctuation || isMaxLength || (isLongEnough && i === words.length - 1)) {
        phrases.push({
          phraseText: currentPhraseWords.join(' '),
          startIndex: currentPhraseStart,
          endIndex: i,
          timesCorrect: 0,
          timesMissed: 0,
          isHidden: false
        })

        currentPhraseStart = i + 1
        currentPhraseWords = []
      }
    }

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

    console.log(`📦 Generated ${phrases.length} initial phrase chunks`)
    return
  }

  // Update existing phrases based on session performance
  const missedSet = new Set(missedIndices)
  const hesitatedSet = new Set(hesitatedIndices)

  for (const phrase of existingPhrases) {
    let phraseHadMiss = false
    let phraseHadHesitation = false
    let allWordsCorrect = true

    // Check each word in the phrase
    for (let i = phrase.start_word_index; i <= phrase.end_word_index; i++) {
      if (missedSet.has(i)) {
        phraseHadMiss = true
        allWordsCorrect = false
      } else if (hesitatedSet.has(i)) {
        phraseHadHesitation = true
        allWordsCorrect = false
      }
    }

    // Calculate new times_correct and times_missed
    let newTimesCorrect = phrase.times_correct || 0
    let newTimesMissed = phrase.times_missed || 0
    let newIsHidden = phrase.is_hidden

    if (phraseHadMiss) {
      // Missed word in phrase - increment times_missed, unhide phrase
      newTimesMissed++
      newIsHidden = false
      console.log(`📦 Phrase "${phrase.phrase_text.substring(0, 30)}..." times_missed -> ${newTimesMissed}`)
    } else if (phraseHadHesitation) {
      // Hesitation - lesser penalty but still counts
      newTimesMissed += 0.5
      // Only unhide if pattern of struggle
      if (newTimesMissed >= 2) {
        newIsHidden = false
      }
    } else if (allWordsCorrect) {
      // All words correct - increment times_correct
      newTimesCorrect++
      
      // CHUNK-BASED: Phrase can only be hidden again after 3 consecutive correct sessions
      // AND times_missed must be "recovered" (need 3x correct to offset each miss)
      const recoveryNeeded = Math.ceil(newTimesMissed) * 3
      if (newTimesCorrect >= 3 && newTimesCorrect >= recoveryNeeded) {
        newIsHidden = true
        console.log(`📦 Phrase "${phrase.phrase_text.substring(0, 30)}..." can be hidden (${newTimesCorrect} correct, recovered from ${newTimesMissed} misses)`)
      }
    }

    // Update the phrase in database
    await supabase
      .from('speech_phrases')
      .update({
        times_correct: Math.round(newTimesCorrect),
        times_missed: Math.round(newTimesMissed * 10) / 10, // Keep 1 decimal for hesitations
        is_hidden: newIsHidden
      })
      .eq('id', phrase.id)
  }

  console.log(`📦 Updated ${existingPhrases.length} phrase chunks, ${phrasesNeedingRecovery.size} flagged for recovery`)
}
