import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, Mic, MicOff, Lightbulb, FileText, SkipForward,
  Hash, Calendar, Sparkles, User, Zap, CheckCircle2, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface FreestyleTopic {
  id: string;
  topic_order: number;
  topic_name: string;
  summary_hint: string | null;
  original_text: string | null;
}

interface FreestyleKeyword {
  id: string;
  topic_id: string;
  keyword: string;
  keyword_type: 'number' | 'date' | 'concept' | 'name' | 'action';
  importance: 'high' | 'medium' | 'low';
  display_order: number;
}

interface KeywordFreestyleViewProps {
  topics: FreestyleTopic[];
  keywords: FreestyleKeyword[];
  speechTitle: string;
  speechLanguage?: string;
  onComplete: (data: {
    coveredKeywords: string[];
    missedKeywords: string[];
    durationSeconds: number;
    topicsCovered: number;
    totalTopics: number;
  }) => void;
  onExit: () => void;
}

// Helper functions for word matching
const normalizeWord = (word: string): string => {
  return word
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, '')
    .replace(/^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)\s+/i, '')
    .replace(/(ing|ed|s|es|tion|ness|ment|ly)$/i, '')
    .trim();
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
};

const isSimilarWord = (spoken: string, target: string): boolean => {
  const normalizedSpoken = normalizeWord(spoken);
  const normalizedTarget = normalizeWord(target);
  if (normalizedSpoken === normalizedTarget) return true;
  if (normalizedSpoken.includes(normalizedTarget) || normalizedTarget.includes(normalizedSpoken)) return true;
  const distance = levenshteinDistance(normalizedSpoken, normalizedTarget);
  const maxLen = Math.max(normalizedSpoken.length, normalizedTarget.length);
  return maxLen > 3 && distance <= Math.ceil(maxLen * 0.3);
};

const getRecognitionLocale = (lang?: string): string => {
  const localeMap: Record<string, string> = {
    'sv': 'sv-SE', 'en': 'en-US', 'de': 'de-DE', 'fr': 'fr-FR',
    'es': 'es-ES', 'it': 'it-IT', 'pt': 'pt-PT'
  };
  return localeMap[lang || 'en'] || 'en-US';
};

const KEYWORD_TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  number: { icon: Hash, label: 'Numbers & Stats', color: 'text-blue-500' },
  date: { icon: Calendar, label: 'Dates & Times', color: 'text-purple-500' },
  concept: { icon: Sparkles, label: 'Key Concepts', color: 'text-amber-500' },
  name: { icon: User, label: 'Names', color: 'text-green-500' },
  action: { icon: Zap, label: 'Actions', color: 'text-red-500' },
};

const TRANSITION_PHRASES = [
  'moving on', 'next', "let's talk about", 'now', 'furthermore',
  'additionally', 'also', 'another point', 'secondly', 'thirdly',
  'finally', 'in conclusion', 'to summarize', 'to sum up'
];

export const KeywordFreestyleView: React.FC<KeywordFreestyleViewProps> = ({
  topics,
  keywords,
  speechTitle,
  speechLanguage,
  onComplete,
  onExit
}) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [completedTopics, setCompletedTopics] = useState<Set<number>>(new Set());
  const [coveredKeywords, setCoveredKeywords] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [panicMode, setPanicMode] = useState<'hint' | 'fullText' | null>(null);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const sortedTopics = [...topics].sort((a, b) => a.topic_order - b.topic_order);
  const currentTopic = sortedTopics[currentTopicIndex];
  const nextTopic = sortedTopics[currentTopicIndex + 1];
  
  const currentTopicKeywords = keywords.filter(k => k.topic_id === currentTopic?.id);
  const nextTopicKeywords = nextTopic ? keywords.filter(k => k.topic_id === nextTopic.id) : [];
  
  const totalKeywords = keywords.length;
  const coveredCount = coveredKeywords.size;
  const overallProgress = totalKeywords > 0 ? (coveredCount / totalKeywords) * 100 : 0;

  // Group keywords by type
  const groupKeywordsByType = (kws: FreestyleKeyword[]) => {
    const groups: Record<string, FreestyleKeyword[]> = {};
    kws.forEach(k => {
      if (!groups[k.keyword_type]) groups[k.keyword_type] = [];
      groups[k.keyword_type].push(k);
    });
    return groups;
  };

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getRecognitionLocale(speechLanguage);

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
      }
      setTranscript(fullTranscript);
      checkKeywordsAndTransitions(fullTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech' && isRecording) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, [speechLanguage, isRecording]);

  // Check spoken words against keywords and detect transitions
  const checkKeywordsAndTransitions = useCallback((text: string) => {
    const words = text.toLowerCase().split(/\s+/);
    const newCovered = new Set(coveredKeywords);
    
    // Check current topic keywords
    currentTopicKeywords.forEach(keyword => {
      if (!newCovered.has(keyword.id)) {
        const keywordParts = keyword.keyword.toLowerCase().split(/\s+/);
        const isMatched = keywordParts.every(part =>
          words.some(word => isSimilarWord(word, part))
        );
        if (isMatched) {
          newCovered.add(keyword.id);
        }
      }
    });

    // Check for transition phrases or next topic keywords (auto-advance)
    if (nextTopic && currentTopicIndex < sortedTopics.length - 1) {
      const hasTransition = TRANSITION_PHRASES.some(phrase =>
        text.toLowerCase().includes(phrase)
      );
      
      const nextKeywordMentioned = nextTopicKeywords.some(keyword => {
        const keywordParts = keyword.keyword.toLowerCase().split(/\s+/);
        return keywordParts.every(part =>
          words.some(word => isSimilarWord(word, part))
        );
      });

      // Check if most of current topic keywords are covered
      const currentCoveredCount = currentTopicKeywords.filter(k => newCovered.has(k.id)).length;
      const coveragePercent = currentTopicKeywords.length > 0 
        ? (currentCoveredCount / currentTopicKeywords.length) * 100 
        : 0;

      if ((hasTransition || nextKeywordMentioned) && coveragePercent >= 50) {
        // Clear any existing timeout
        if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
        // Delay auto-advance slightly for smooth UX
        autoAdvanceTimeoutRef.current = setTimeout(() => {
          advanceToNextTopic();
        }, 1000);
      }
    }

    if (newCovered.size !== coveredKeywords.size) {
      setCoveredKeywords(newCovered);
    }
  }, [coveredKeywords, currentTopicKeywords, nextTopicKeywords, currentTopicIndex, sortedTopics.length, nextTopic]);

  const advanceToNextTopic = () => {
    if (currentTopicIndex < sortedTopics.length - 1) {
      setCompletedTopics(prev => new Set([...prev, currentTopicIndex]));
      setCurrentTopicIndex(prev => prev + 1);
      setPanicMode(null);
    }
  };

  const skipTopic = () => {
    advanceToNextTopic();
  };

  // Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    // Mark current topic as completed
    setCompletedTopics(prev => new Set([...prev, currentTopicIndex]));

    // Calculate results
    const covered = keywords.filter(k => coveredKeywords.has(k.id)).map(k => k.keyword);
    const missed = keywords.filter(k => !coveredKeywords.has(k.id)).map(k => k.keyword);

    onComplete({
      coveredKeywords: covered,
      missedKeywords: missed,
      durationSeconds: elapsedTime,
      topicsCovered: completedTopics.size + 1,
      totalTopics: sortedTopics.length
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getImportanceBadgeClass = (importance: string) => {
    switch (importance) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const currentGroupedKeywords = groupKeywordsByType(currentTopicKeywords);

  if (!currentTopic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No topics found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={onExit}>
            <X className="h-5 w-5" />
          </Button>
          
          {/* Topic dots */}
          <div className="flex items-center gap-2">
            {sortedTopics.map((topic, index) => (
              <div
                key={topic.id}
                className={cn(
                  "transition-all duration-300",
                  index === currentTopicIndex 
                    ? "scale-125" 
                    : ""
                )}
              >
                {completedTopics.has(index) ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : index === currentTopicIndex ? (
                  <Circle className="h-4 w-4 text-primary fill-primary" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>

          <span className="text-lg font-mono text-foreground">{formatTime(elapsedTime)}</span>
        </div>

        {/* Overall progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('freestyle.topicOf', 'Topic {{current}} of {{total}}', { current: currentTopicIndex + 1, total: sortedTopics.length })}</span>
            <span>{coveredCount}/{totalKeywords} {t('freestyle.keywords', 'keywords')}</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Current Topic Card */}
          <Card className="p-5 border-primary/50 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">{currentTopic.topic_name}</h2>
              <Badge variant="outline" className="text-primary border-primary">
                {t('freestyle.currentTopic', 'Current')}
              </Badge>
            </div>

            {/* Panic Mode Content */}
            {panicMode === 'hint' && currentTopic.summary_hint && (
              <div 
                className="mb-4 p-4 bg-amber-500/20 border border-amber-500/30 rounded-lg cursor-pointer"
                onClick={() => setPanicMode(null)}
              >
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-100 text-lg">{currentTopic.summary_hint}</p>
                </div>
                <p className="text-xs text-amber-400/70 mt-2">Tap to hide</p>
              </div>
            )}

            {panicMode === 'fullText' && currentTopic.original_text && (
              <div 
                className="mb-4 p-4 bg-muted border border-border rounded-lg max-h-48 overflow-y-auto cursor-pointer"
                onClick={() => setPanicMode(null)}
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-foreground text-sm leading-relaxed">{currentTopic.original_text}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Tap to hide</p>
              </div>
            )}

            {/* Keywords grouped by type */}
            <div className="space-y-4">
              {Object.entries(currentGroupedKeywords).map(([type, typeKeywords]) => {
                const config = KEYWORD_TYPE_CONFIG[type];
                const Icon = config?.icon || Sparkles;
                return (
                  <div key={type}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn("h-4 w-4", config?.color || 'text-muted-foreground')} />
                      <span className="text-sm font-medium text-muted-foreground">
                        {config?.label || type}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {typeKeywords
                        .sort((a, b) => {
                          const order = { high: 0, medium: 1, low: 2 };
                          return order[a.importance] - order[b.importance];
                        })
                        .map(keyword => {
                          const isCovered = coveredKeywords.has(keyword.id);
                          return (
                            <Badge
                              key={keyword.id}
                              variant="outline"
                              className={cn(
                                "text-base py-1.5 px-3 transition-all duration-300",
                                getImportanceBadgeClass(keyword.importance),
                                isCovered && "line-through opacity-50 bg-primary/20 border-primary/30"
                              )}
                            >
                              {isCovered && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {keyword.keyword}
                            </Badge>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Next Topic Preview */}
          {nextTopic && (
            <Card className="p-4 border-dashed border-muted-foreground/30 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{t('freestyle.nextUp', 'Next up')}</span>
                <SkipForward className="h-3 w-3 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">{nextTopic.topic_name}</h3>
              <div className="flex flex-wrap gap-1.5">
                {nextTopicKeywords
                  .filter(k => k.importance === 'high')
                  .slice(0, 4)
                  .map(keyword => (
                    <Badge
                      key={keyword.id}
                      variant="outline"
                      className="text-xs text-muted-foreground/70 border-muted-foreground/20"
                    >
                      {keyword.keyword}
                    </Badge>
                  ))}
                {nextTopicKeywords.filter(k => k.importance === 'high').length > 4 && (
                  <span className="text-xs text-muted-foreground/50">
                    +{nextTopicKeywords.filter(k => k.importance === 'high').length - 4} more
                  </span>
                )}
              </div>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Controls */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border p-4 space-y-3">
        {/* Panic Buttons */}
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanicMode(panicMode === 'hint' ? null : 'hint')}
            className={cn(
              "gap-1.5",
              panicMode === 'hint' && "bg-amber-500/20 border-amber-500"
            )}
            disabled={!currentTopic.summary_hint}
          >
            <Lightbulb className="h-4 w-4" />
            {t('freestyle.showHint', 'Hint')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanicMode(panicMode === 'fullText' ? null : 'fullText')}
            className={cn(
              "gap-1.5",
              panicMode === 'fullText' && "bg-muted border-foreground"
            )}
            disabled={!currentTopic.original_text}
          >
            <FileText className="h-4 w-4" />
            {t('freestyle.showFullText', 'Show Text')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={skipTopic}
            disabled={currentTopicIndex >= sortedTopics.length - 1}
            className="gap-1.5"
          >
            <SkipForward className="h-4 w-4" />
            {t('freestyle.skipTopic', 'Skip')}
          </Button>
        </div>

        {/* Recording Button */}
        <div className="flex justify-center">
          {!isRecording ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="gap-2 px-8 bg-primary hover:bg-primary/90"
            >
              <Mic className="h-5 w-5" />
              {t('freestyle.startSpeaking', 'Start Speaking')}
            </Button>
          ) : (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="gap-2 px-8"
            >
              <MicOff className="h-5 w-5" />
              {t('freestyle.finish', 'Finish')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeywordFreestyleView;
