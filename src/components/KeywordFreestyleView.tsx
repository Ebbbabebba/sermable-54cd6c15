import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Square, X, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FreestyleKeyword {
  id: string;
  topic: string;
  keyword: string;
  importance: 'high' | 'medium' | 'low';
  display_order: number;
}

interface KeywordFreestyleViewProps {
  keywords: FreestyleKeyword[];
  speechTitle: string;
  speechLanguage: string;
  onComplete: (coveredKeywords: string[], missedKeywords: string[], duration: number) => void;
  onExit: () => void;
}

// Group keywords by topic
const groupByTopic = (keywords: FreestyleKeyword[]) => {
  const groups: { [topic: string]: FreestyleKeyword[] } = {};
  keywords.forEach(kw => {
    if (!groups[kw.topic]) {
      groups[kw.topic] = [];
    }
    groups[kw.topic].push(kw);
  });
  return groups;
};

// Normalize word for matching
const normalizeWord = (word: string): string => {
  return word
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/s$/, '')
    .replace(/ing$/, '')
    .replace(/ed$/, '')
    .replace(/ly$/, '')
    .trim();
};

// Calculate Levenshtein distance for fuzzy matching
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
};

// Check if spoken word matches target keyword
const isSimilarWord = (spoken: string, target: string): boolean => {
  const normalizedSpoken = normalizeWord(spoken);
  const normalizedTarget = normalizeWord(target);
  
  // Exact match after normalization
  if (normalizedSpoken === normalizedTarget) return true;
  
  // Contains match for multi-word keywords
  if (normalizedSpoken.includes(normalizedTarget) || normalizedTarget.includes(normalizedSpoken)) {
    return true;
  }
  
  // Fuzzy match using Levenshtein distance
  const maxDistance = Math.floor(normalizedTarget.length * 0.3);
  return levenshteinDistance(normalizedSpoken, normalizedTarget) <= maxDistance;
};

// Get recognition locale from language code
const getRecognitionLocale = (lang: string): string => {
  const localeMap: { [key: string]: string } = {
    'en': 'en-US',
    'sv': 'sv-SE',
    'de': 'de-DE',
    'fr': 'fr-FR',
    'es': 'es-ES',
    'it': 'it-IT',
    'pt': 'pt-PT',
  };
  return localeMap[lang] || lang || 'en-US';
};

export const KeywordFreestyleView = ({
  keywords,
  speechTitle,
  speechLanguage,
  onComplete,
  onExit
}: KeywordFreestyleViewProps) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [coveredKeywords, setCoveredKeywords] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  const groupedKeywords = groupByTopic(keywords);
  const totalKeywords = keywords.length;
  const coveredCount = coveredKeywords.size;
  const progressPercent = totalKeywords > 0 ? (coveredCount / totalKeywords) * 100 : 0;

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
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
        checkKeywords(fullTranscript);
      };
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Restart recognition on no-speech
          try {
            recognition.stop();
            setTimeout(() => {
              if (isRecording) {
                recognition.start();
              }
            }, 100);
          } catch (e) {
            console.log('Error restarting recognition');
          }
        }
      };
      
      recognition.onend = () => {
        // Auto restart if still recording
        if (isRecording) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Could not restart recognition');
          }
        }
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [speechLanguage]);

  // Check spoken text against keywords
  const checkKeywords = (spokenText: string) => {
    const words = spokenText.toLowerCase().split(/\s+/);
    
    keywords.forEach(kw => {
      if (coveredKeywords.has(kw.keyword)) return;
      
      // Check each word against the keyword
      const keywordParts = kw.keyword.toLowerCase().split(/\s+/);
      
      // For single-word keywords
      if (keywordParts.length === 1) {
        for (const word of words) {
          if (isSimilarWord(word, kw.keyword)) {
            setCoveredKeywords(prev => new Set([...prev, kw.keyword]));
            break;
          }
        }
      } else {
        // For multi-word keywords, check if all parts are present in sequence
        const joinedText = spokenText.toLowerCase();
        if (joinedText.includes(kw.keyword.toLowerCase()) || 
            isSimilarWord(joinedText, kw.keyword)) {
          setCoveredKeywords(prev => new Set([...prev, kw.keyword]));
        }
      }
    });
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    startTimeRef.current = Date.now();
    
    // Start timer
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    
    // Start speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started');
      }
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop speech recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    
    // Calculate missed keywords
    const missed = keywords
      .filter(kw => !coveredKeywords.has(kw.keyword))
      .map(kw => kw.keyword);
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    onComplete(Array.from(coveredKeywords), missed, duration);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'medium':
        return 'bg-primary/10 text-primary border-primary/30';
      case 'low':
        return 'bg-muted text-muted-foreground border-muted-foreground/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getImportanceLabel = (importance: string) => {
    switch (importance) {
      case 'high':
        return t('freestyle.mustMention', 'Must mention');
      case 'medium':
        return t('freestyle.shouldMention', 'Should mention');
      case 'low':
        return t('freestyle.niceToHave', 'Nice to have');
      default:
        return importance;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X className="h-4 w-4 mr-2" />
          {t('common.exit', 'Exit')}
        </Button>
        
        <div className="flex items-center gap-2 text-lg font-mono">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {formatTime(elapsedTime)}
        </div>
        
        <div className="w-24" /> {/* Spacer */}
      </div>

      {/* Title */}
      <div className="text-center py-4 px-6">
        <h1 className="text-xl font-semibold">{speechTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {t('freestyle.keywordMode', 'Keyword Mode')} • {coveredCount}/{totalKeywords} {t('freestyle.covered', 'covered')}
        </p>
      </div>

      {/* Progress bar */}
      <div className="px-6 pb-4">
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Keywords grouped by topic */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-6">
        {Object.entries(groupedKeywords).map(([topic, topicKeywords]) => {
          // Sort by importance: high first, then medium, then low
          const sortedKeywords = [...topicKeywords].sort((a, b) => {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.importance] - order[b.importance];
          });
          
          return (
            <Card key={topic} className="border-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">{topic}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Group by importance within topic */}
                {['high', 'medium', 'low'].map(importance => {
                  const importanceKeywords = sortedKeywords.filter(kw => kw.importance === importance);
                  if (importanceKeywords.length === 0) return null;
                  
                  return (
                    <div key={importance} className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        {getImportanceLabel(importance)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {importanceKeywords.map(kw => {
                          const isCovered = coveredKeywords.has(kw.keyword);
                          return (
                            <Badge
                              key={kw.id}
                              variant="outline"
                              className={cn(
                                "text-sm py-1.5 px-3 transition-all duration-300",
                                getImportanceColor(kw.importance),
                                isCovered && "line-through opacity-50 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
                              )}
                            >
                              {isCovered && <Check className="h-3 w-3 mr-1" />}
                              {kw.keyword}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recording controls */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-6">
        <div className="max-w-md mx-auto flex flex-col items-center gap-4">
          {!isRecording ? (
            <Button
              size="lg"
              onClick={handleStartRecording}
              className="w-full max-w-xs gap-2"
            >
              <Mic className="h-5 w-5" />
              {t('freestyle.startSpeaking', 'Start Speaking')}
            </Button>
          ) : (
            <Button
              size="lg"
              variant="destructive"
              onClick={handleStopRecording}
              className="w-full max-w-xs gap-2 animate-pulse"
            >
              <Square className="h-5 w-5" />
              {t('freestyle.stopFinish', 'Stop & Finish')}
            </Button>
          )}
          
          {isRecording && (
            <p className="text-sm text-muted-foreground text-center">
              {t('freestyle.speakNaturally', 'Speak naturally - keywords will highlight as you mention them')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
