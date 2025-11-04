import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { X, Settings, Eye, EyeOff } from "lucide-react";
import PresentationControls from "@/components/PresentationControls";
import { cn } from "@/lib/utils";

interface Speech {
  id: string;
  title: string;
  text_original: string;
  text_current: string;
}

const Presentation = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [spokenWords, setSpokenWords] = useState<Set<string>>(new Set());
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [lastSpeakTime, setLastSpeakTime] = useState(Date.now());
  
  // Settings
  const [pauseThreshold, setPauseThreshold] = useState(4000); // 4 seconds
  const [autoReveal, setAutoReveal] = useState(true);
  const [fontSize, setFontSize] = useState(32);
  
  const recognitionRef = useRef<any>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordsRef = useRef<string[]>([]);

  useEffect(() => {
    loadSpeech();
    
    // ESC key to exit
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleExit();
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [id]);

  useEffect(() => {
    if (isLiveMode && speech) {
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }

    return () => stopSpeechRecognition();
  }, [isLiveMode, speech]);

  // Pause detection
  useEffect(() => {
    if (isLiveMode && autoReveal) {
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }

      pauseTimerRef.current = setTimeout(() => {
        const timeSinceLastSpeak = Date.now() - lastSpeakTime;
        if (timeSinceLastSpeak >= pauseThreshold) {
          setIsPaused(true);
          // Auto-reveal next word
          if (currentWordIndex < wordsRef.current.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
          }
        }
      }, pauseThreshold);

      return () => {
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current);
        }
      };
    }
  }, [lastSpeakTime, isLiveMode, autoReveal, pauseThreshold, currentWordIndex]);

  const loadSpeech = async () => {
    try {
      const { data, error } = await supabase
        .from("speeches")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      
      setSpeech(data);
      // Use cue text if available, otherwise use original
      const textToUse = data.text_current || data.text_original;
      wordsRef.current = textToUse.split(/\s+/);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading speech",
        description: error.message,
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const startSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        variant: "destructive",
        title: "Speech recognition not supported",
        description: "Your browser doesn't support speech recognition",
      });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      setLastSpeakTime(Date.now());
      setIsPaused(false);
      
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      const transcriptWords = transcript.toLowerCase().split(/\s+/);
      const newSpokenWords = new Set(spokenWords);
      
      transcriptWords.forEach(word => {
        const cleanWord = word.replace(/[^\w]/g, '');
        if (cleanWord) {
          newSpokenWords.add(cleanWord);
        }
      });
      
      setSpokenWords(newSpokenWords);
      
      // Update current word index
      for (let i = currentWordIndex; i < wordsRef.current.length; i++) {
        const word = wordsRef.current[i].toLowerCase().replace(/[^\w]/g, '');
        if (newSpokenWords.has(word)) {
          setCurrentWordIndex(i);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  const handleExit = () => {
    stopSpeechRecognition();
    navigate(`/practice/${id}`);
  };

  const toggleLiveMode = () => {
    setIsLiveMode(!isLiveMode);
    setSpokenWords(new Set());
    setCurrentWordIndex(0);
    setIsPaused(false);
  };

  const getWordStyle = (index: number, word: string) => {
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
    
    if (isLiveMode) {
      if (index < currentWordIndex) {
        // Already spoken
        return "opacity-40";
      } else if (index === currentWordIndex) {
        // Current word
        return isPaused 
          ? "text-warning animate-pulse" 
          : "text-primary font-semibold scale-110";
      } else {
        // Not yet spoken
        return "opacity-60";
      }
    }
    
    return "";
  };

  const displayText = isLiveMode 
    ? speech?.text_current || speech?.text_original 
    : speech?.text_original;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">Loading presentation...</div>
        </div>
      </div>
    );
  }

  if (!speech) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* Top Controls */}
      <div className={cn(
        "fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border p-4 transition-transform duration-300",
        showControls ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="container mx-auto flex items-center justify-between">
          <h2 className="text-lg font-semibold truncate max-w-md">{speech.title}</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLiveMode}
            >
              {isLiveMode ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {isLiveMode ? "Preview Mode" : "Live Mode"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowControls(!showControls)}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleExit}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showControls && (
        <PresentationControls
          pauseThreshold={pauseThreshold}
          setPauseThreshold={setPauseThreshold}
          autoReveal={autoReveal}
          setAutoReveal={setAutoReveal}
          fontSize={fontSize}
          setFontSize={setFontSize}
          onClose={() => setShowControls(false)}
        />
      )}

      {/* Main Content */}
      <div 
        className="min-h-screen flex items-center justify-center p-8 cursor-pointer"
        onClick={() => setShowControls(!showControls)}
      >
        <div 
          className="max-w-4xl mx-auto leading-relaxed"
          style={{ fontSize: `${fontSize}px` }}
        >
          {displayText?.split(/(\s+)/).map((segment, index) => {
            if (/^\s+$/.test(segment)) {
              return <span key={index}>{segment}</span>;
            }
            
            const wordIndex = Math.floor(index / 2);
            
            return (
              <span
                key={index}
                className={cn(
                  "inline-block px-1 transition-all duration-300",
                  getWordStyle(wordIndex, segment)
                )}
              >
                {segment}
              </span>
            );
          })}
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div>
            {isLiveMode ? (
              <span className="flex items-center gap-2">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  isPaused ? "bg-warning animate-pulse" : "bg-success"
                )} />
                {isPaused ? "Paused - Next word will reveal soon" : "Listening..."}
              </span>
            ) : (
              "Click anywhere to toggle controls • Press ESC to exit"
            )}
          </div>
          <div>
            Progress: {currentWordIndex} / {wordsRef.current.length} words
          </div>
        </div>
      </div>
    </div>
  );
};

export default Presentation;
