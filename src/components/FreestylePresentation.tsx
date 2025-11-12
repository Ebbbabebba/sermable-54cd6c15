import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, ArrowRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Segment {
  id: string;
  segment_order: number;
  content: string;
  importance_level: 'high' | 'medium' | 'low';
  cue_words: string[];
}

interface FreestylePresentationProps {
  segments: Segment[];
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onComplete: () => void;
}

export const FreestylePresentation = ({
  segments,
  isRecording,
  onStartRecording,
  onStopRecording,
  onComplete
}: FreestylePresentationProps) => {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [coveredSegments, setCoveredSegments] = useState<number[]>([]);
  const [mentionedCueWords, setMentionedCueWords] = useState<Set<string>>(new Set());
  const [transcript, setTranscript] = useState("");
  const [showSupportPrompt, setShowSupportPrompt] = useState(false);
  const [pauseTimer, setPauseTimer] = useState<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const currentSegment = segments[currentSegmentIndex];
  const coveragePercent = (coveredSegments.length / segments.length) * 100;

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' ';
          } else {
            interimTranscript += transcriptPiece;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          checkCueWords(finalTranscript);
          resetPauseTimer();
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (pauseTimer) {
        clearTimeout(pauseTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.start();
    } else if (!isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  const checkCueWords = (text: string) => {
    const lowerText = text.toLowerCase();
    const newMentioned = new Set(mentionedCueWords);

    currentSegment.cue_words.forEach(word => {
      if (lowerText.includes(word.toLowerCase())) {
        newMentioned.add(word);
      }
    });

    setMentionedCueWords(newMentioned);

    // Check if all important cue words in current segment are covered
    const currentSegmentWords = currentSegment.cue_words;
    const coveredWords = currentSegmentWords.filter(word => 
      Array.from(newMentioned).some(m => m.toLowerCase() === word.toLowerCase())
    );

    if (coveredWords.length >= currentSegmentWords.length * 0.7) {
      // Mark segment as covered
      if (!coveredSegments.includes(currentSegmentIndex)) {
        setCoveredSegments(prev => [...prev, currentSegmentIndex]);
      }
    }
  };

  const resetPauseTimer = () => {
    if (pauseTimer) {
      clearTimeout(pauseTimer);
    }

    const timer = setTimeout(() => {
      setShowSupportPrompt(true);
    }, 5000); // Show support after 5 seconds of silence

    setPauseTimer(timer);
  };

  const handleNextSegment = () => {
    setShowSupportPrompt(false);
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(currentSegmentIndex + 1);
    } else {
      onComplete();
    }
  };

  const getSegmentColor = (index: number) => {
    if (coveredSegments.includes(index)) {
      return 'bg-primary/20 border-primary';
    }
    if (index === currentSegmentIndex) {
      return 'bg-purple-500/10 border-purple-500';
    }
    return 'bg-muted/30 border-border';
  };

  const getImportanceColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-500/5 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Progress Bar */}
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Coverage Progress</span>
              <span className="text-muted-foreground">{coveredSegments.length}/{segments.length} segments</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${coveragePercent}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Support Prompt */}
        {showSupportPrompt && (
          <Card className="p-6 bg-yellow-500/10 border-yellow-500/30 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-6 h-6 text-yellow-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Need a reminder?</h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  {currentSegment.content}
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowSupportPrompt(false)}
                  className="border-yellow-500/30"
                >
                  Got it, continuing...
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Current Segment Display */}
        <Card className="p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={getImportanceColor(currentSegment.importance_level)}>
                {currentSegment.importance_level.toUpperCase()} Priority
              </Badge>
              <span className="text-sm text-muted-foreground">
                Segment {currentSegmentIndex + 1} of {segments.length}
              </span>
            </div>

            {/* Cue Words */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Key Points to Cover:</h3>
              <div className="flex flex-wrap gap-2">
                {currentSegment.cue_words.map((word, idx) => {
                  const isMentioned = Array.from(mentionedCueWords).some(m => 
                    m.toLowerCase() === word.toLowerCase()
                  );
                  return (
                    <Badge 
                      key={idx}
                      variant="outline"
                      className={cn(
                        "px-3 py-1 text-sm transition-all duration-300",
                        isMentioned 
                          ? "bg-primary text-primary-foreground border-primary line-through" 
                          : "bg-background hover:bg-muted"
                      )}
                    >
                      {word}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Next Segment Button */}
            {coveredSegments.includes(currentSegmentIndex) && (
              <Button 
                onClick={handleNextSegment}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
              >
                {currentSegmentIndex < segments.length - 1 ? (
                  <>Next Segment <ArrowRight className="ml-2 w-4 h-4" /></>
                ) : (
                  'Complete Presentation'
                )}
              </Button>
            )}
          </div>
        </Card>

        {/* All Segments Overview */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4">All Segments</h3>
          <div className="grid gap-3">
            {segments.map((segment, idx) => (
              <div
                key={segment.id}
                className={cn(
                  "p-3 rounded-lg border-2 transition-all duration-300",
                  getSegmentColor(idx)
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Segment {idx + 1}</span>
                  {coveredSegments.includes(idx) && (
                    <Badge className="bg-primary">Covered</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recording Controls */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <Button
            size="lg"
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={cn(
              "rounded-full w-20 h-20 shadow-2xl transition-all duration-300",
              isRecording 
                ? "bg-red-500 hover:bg-red-600 animate-pulse" 
                : "bg-gradient-to-r from-purple-500 to-pink-500 hover:scale-110"
            )}
          >
            {isRecording ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
