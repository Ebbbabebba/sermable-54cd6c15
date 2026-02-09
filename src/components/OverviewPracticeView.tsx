import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mic, Square, Loader2, BookOpen, Eye, EyeOff, ChevronRight } from "lucide-react";
import OverviewTopicCard from "./OverviewTopicCard";
import OverviewResults from "./OverviewResults";
import AudioRecorder, { AudioRecorderHandle } from "./AudioRecorder";
import { motion, AnimatePresence } from "framer-motion";

interface Topic {
  id: string;
  speech_id: string;
  topic_order: number;
  topic_title: string;
  key_points: string[];
  key_words: string[];
  key_numbers: string[];
  original_section: string | null;
  is_mastered: boolean;
  practice_count: number;
  last_coverage_score: number | null;
}

interface SectionScore {
  topic_id: string;
  topic_title: string;
  score: number;
  main_idea_captured: boolean;
  key_words_mentioned: string[];
  key_words_missed: string[];
  numbers_mentioned: string[];
  numbers_missed: string[];
  feedback: string;
}

interface OverviewPracticeViewProps {
  speechId: string;
  speechTitle: string;
  speechText: string;
  speechLanguage: string;
  onBack: () => void;
}

type Phase = 'read' | 'practice' | 'recording' | 'processing' | 'section-result' | 'results';

// Levenshtein distance for fuzzy matching
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

const normalize = (s: string) => s.toLowerCase().replace(/[^\w\d]/g, '');

export const OverviewPracticeView = ({
  speechId,
  speechTitle,
  speechText,
  speechLanguage,
  onBack,
}: OverviewPracticeViewProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const audioRecorderRef = useRef<AudioRecorderHandle>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>('read');
  const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
  const [isRecording, setIsRecording] = useState(false);

  // Section-by-section state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [sectionScores, setSectionScores] = useState<SectionScore[]>([]);
  const [currentSectionScore, setCurrentSectionScore] = useState<SectionScore | null>(null);

  // Real-time matching state
  const [mentionedKeyWords, setMentionedKeyWords] = useState<string[]>([]);
  const [mentionedKeyNumbers, setMentionedKeyNumbers] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadTopics();
  }, [speechId]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const { data: existingTopics, error } = await supabase
        .from("overview_topics")
        .select("*")
        .eq("speech_id", speechId)
        .order("topic_order", { ascending: true });

      if (error) throw error;

      if (existingTopics && existingTopics.length > 0) {
        const typedTopics = existingTopics.map(t => ({
          ...t,
          key_words: (t as any).key_words || [],
          key_numbers: (t as any).key_numbers || [],
        })) as Topic[];
        setTopics(typedTopics);

        const avgPracticeCount = typedTopics.reduce((sum, t) => sum + (t.practice_count || 0), 0) / typedTopics.length;
        if (avgPracticeCount >= 5) setHintLevel(3);
        else if (avgPracticeCount >= 2) setHintLevel(2);
        else setHintLevel(1);
      } else {
        await extractTopics();
      }
    } catch (error) {
      console.error("Error loading topics:", error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('overviewMode.failedToLoadTopics'),
      });
    } finally {
      setLoading(false);
    }
  };

  const extractTopics = async () => {
    try {
      toast({
        title: t('overviewMode.extractingTopics'),
        description: t('overviewMode.pleaseWait'),
      });

      const { data, error } = await supabase.functions.invoke('extract-speech-topics', {
        body: { speechId, speechText, speechLanguage },
      });

      if (error) throw error;

      if (data?.topics) {
        const typedTopics = data.topics.map((t: any) => ({
          ...t,
          key_words: t.key_words || [],
          key_numbers: t.key_numbers || [],
        })) as Topic[];
        setTopics(typedTopics);
        toast({
          title: t('overviewMode.topicsExtracted'),
          description: t('overviewMode.topicsExtractedDesc', { count: typedTopics.length }),
        });
      }
    } catch (error) {
      console.error("Error extracting topics:", error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('overviewMode.failedToExtract'),
      });
    }
  };

  const currentTopic = topics[currentSectionIndex];

  // Real-time fuzzy matching of transcribed words against keywords/numbers
  const matchTranscription = useCallback((text: string) => {
    if (!currentTopic) return;

    const words = text.split(/\s+/).map(normalize).filter(Boolean);

    const newMentionedWords: string[] = [];
    for (const kw of currentTopic.key_words) {
      const kwNorm = normalize(kw);
      if (kwNorm.length === 0) continue;
      for (const word of words) {
        if (word.length === 0) continue;
        const maxDist = kwNorm.length <= 3 ? 0 : 2;
        if (levenshtein(word, kwNorm) <= maxDist) {
          newMentionedWords.push(kw);
          break;
        }
      }
    }

    const newMentionedNumbers: string[] = [];
    for (const kn of currentTopic.key_numbers) {
      const numParts = kn.match(/\d+[\d.,]*/g);
      if (!numParts) continue;
      for (const word of words) {
        for (const numPart of numParts) {
          if (word.includes(numPart.replace(/[.,]/g, ''))) {
            newMentionedNumbers.push(kn);
            break;
          }
        }
        if (newMentionedNumbers.includes(kn)) break;
      }
    }

    setMentionedKeyWords(prev => {
      const combined = new Set([...prev, ...newMentionedWords]);
      return Array.from(combined);
    });
    setMentionedKeyNumbers(prev => {
      const combined = new Set([...prev, ...newMentionedNumbers]);
      return Array.from(combined);
    });
  }, [currentTopic]);

  const startRealtimeRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage === 'sv' ? 'sv-SE' : speechLanguage === 'de' ? 'de-DE' : speechLanguage === 'fr' ? 'fr-FR' : speechLanguage === 'es' ? 'es-ES' : 'en-US';

    recognition.onresult = (event: any) => {
      let fullText = '';
      for (let i = 0; i < event.results.length; i++) {
        fullText += event.results[i][0].transcript + ' ';
      }
      matchTranscription(fullText);
    };

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event.error);
    };

    recognition.onend = () => {
      // Restart if still recording
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch {}
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.log("Could not start speech recognition:", e);
    }
  }, [speechLanguage, matchTranscription]);

  const stopRealtimeRecognition = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  };

  const startRecording = () => {
    setPhase('recording');
    setIsRecording(true);
    setMentionedKeyWords([]);
    setMentionedKeyNumbers([]);
    audioRecorderRef.current?.startRecording();
    startRealtimeRecognition();
  };

  const stopRecording = () => {
    setIsRecording(false);
    stopRealtimeRecognition();
    audioRecorderRef.current?.stopRecording();
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setPhase('processing');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);

      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio, language: speechLanguage },
        });

        if (transcribeError) throw transcribeError;

        const userTranscription = transcribeData?.text || "";

        if (!userTranscription.trim()) {
          toast({
            variant: "destructive",
            title: t('overviewMode.noSpeechDetected'),
            description: t('overviewMode.tryAgainLouder'),
          });
          setPhase('practice');
          return;
        }

        // Final match with full transcription
        matchTranscription(userTranscription);

        // Analyze this specific section
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-overview-session', {
          body: {
            speechId,
            transcription: userTranscription,
            section: {
              topic_id: currentTopic.id,
              topic_title: currentTopic.topic_title,
              key_words: currentTopic.key_words,
              key_numbers: currentTopic.key_numbers,
            },
            hintLevel,
          },
        });

        if (analysisError) throw analysisError;

        const score = analysisData?.sectionScore;
        if (score) {
          const sectionResult: SectionScore = {
            topic_id: currentTopic.id,
            topic_title: currentTopic.topic_title,
            score: score.score || 0,
            main_idea_captured: score.main_idea_captured || false,
            key_words_mentioned: score.key_words_mentioned || [],
            key_words_missed: score.key_words_missed || [],
            numbers_mentioned: score.numbers_mentioned || [],
            numbers_missed: score.numbers_missed || [],
            feedback: score.feedback || "",
          };
          setCurrentSectionScore(sectionResult);
          setSectionScores(prev => [...prev, sectionResult]);
          setPhase('section-result');
        }
      };
    } catch (error) {
      console.error("Error processing recording:", error);
      toast({
        variant: "destructive",
        title: t('common.error'),
        description: t('overviewMode.processingFailed'),
      });
      setPhase('practice');
    }
  };

  const handleNextSection = () => {
    setCurrentSectionScore(null);
    setMentionedKeyWords([]);
    setMentionedKeyNumbers([]);
    if (currentSectionIndex < topics.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      setPhase('practice');
    } else {
      saveSession();
      setPhase('results');
    }
  };

  const saveSession = async () => {
    try {
      const overallScore = sectionScores.length > 0
        ? Math.round(sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length)
        : 0;

      const topicsCovered = sectionScores.filter(s => s.score >= 70).map(s => s.topic_id);
      const topicsPartial = sectionScores.filter(s => s.score >= 40 && s.score < 70).map(s => s.topic_id);
      const topicsMissed = sectionScores.filter(s => s.score < 40).map(s => s.topic_id);

      await supabase.from("overview_sessions").insert({
        speech_id: speechId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        topics_covered: topicsCovered,
        topics_partially_covered: topicsPartial,
        topics_missed: topicsMissed,
        overall_score: overallScore,
        section_scores: sectionScores as any,
        hint_level: hintLevel,
        ai_feedback: sectionScores.map(s => s.feedback).join(" "),
      } as any);
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const handleRetry = () => {
    setSectionScores([]);
    setCurrentSectionScore(null);
    setCurrentSectionIndex(0);
    setMentionedKeyWords([]);
    setMentionedKeyNumbers([]);
    setPhase('practice');
  };

  const toggleHintLevel = () => {
    setHintLevel(prev => prev === 1 ? 2 : prev === 2 ? 3 : 1);
  };

  const getHintLevelLabel = () => {
    switch (hintLevel) {
      case 1: return t('overviewMode.fullHints');
      case 2: return t('overviewMode.titlesOnly');
      case 3: return t('overviewMode.numbersOnly');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t('overviewMode.loadingTopics')}</p>
        </div>
      </div>
    );
  }

  // Final results view
  if (phase === 'results') {
    const overallScore = sectionScores.length > 0
      ? Math.round(sectionScores.reduce((sum, s) => sum + s.score, 0) / sectionScores.length)
      : 0;

    return (
      <OverviewResults
        sectionScores={sectionScores}
        overallScore={overallScore}
        onRetry={handleRetry}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen p-4 pb-32">
      {/* Hidden Audio Recorder */}
      <div className="hidden">
        <AudioRecorder
          ref={audioRecorderRef}
          isRecording={isRecording}
          onStart={() => setIsRecording(true)}
          onStop={handleRecordingComplete}
        />
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('common.back')}
          </Button>

          {phase !== 'read' && (
            <Button variant="outline" size="sm" onClick={toggleHintLevel}>
              {hintLevel === 1 ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
              {getHintLevelLabel()}
            </Button>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{speechTitle}</h1>
          <p className="text-muted-foreground mt-1">
            {t('overviewMode.generalOverview')}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {/* Phase: Read Through */}
          {phase === 'read' && (
            <motion.div
              key="read"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookOpen className="w-5 h-5 text-primary" />
                    {t('overviewMode.readThrough')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {t('overviewMode.readThroughDesc')}
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-foreground leading-relaxed">
                      {speechText}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={() => setPhase('practice')}
                className="w-full"
                size="lg"
              >
                {t('overviewMode.imReady')}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          )}

          {/* Phase: Practice / Recording / Processing — One Section at a Time */}
          {(phase === 'practice' || phase === 'recording' || phase === 'processing') && currentTopic && (
            <motion.div
              key={`practice-${currentSectionIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Progress indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>{t('overviewMode.section')} {currentSectionIndex + 1} / {topics.length}</span>
              </div>

              {/* Current Section Card */}
              <OverviewTopicCard
                topicOrder={currentTopic.topic_order}
                topicTitle={currentTopic.topic_title}
                keyWords={currentTopic.key_words}
                keyNumbers={currentTopic.key_numbers}
                hintLevel={hintLevel}
                lastScore={currentTopic.last_coverage_score}
                isActive
                mentionedKeyWords={mentionedKeyWords}
                mentionedKeyNumbers={mentionedKeyNumbers}
              />

              {/* Explain instruction */}
              <div className="text-center text-sm text-muted-foreground">
                {t('overviewMode.explainSection')}
              </div>
            </motion.div>
          )}

          {/* Phase: Section Result */}
          {phase === 'section-result' && currentSectionScore && (
            <motion.div
              key="section-result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {currentSectionScore.topic_title}
                    </CardTitle>
                    <span className={`text-2xl font-bold ${
                      currentSectionScore.score >= 80 ? "text-green-500" :
                      currentSectionScore.score >= 50 ? "text-yellow-500" : "text-red-500"
                    }`}>
                      {currentSectionScore.score}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {currentSectionScore.main_idea_captured && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      ✅ {t('overviewMode.mainIdea')}
                    </div>
                  )}
                  {currentSectionScore.key_words_missed.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-yellow-600">
                      ⚠️ {t('overviewMode.missedKeywords')}: {currentSectionScore.key_words_missed.join(", ")}
                    </div>
                  )}
                  {currentSectionScore.numbers_missed.length > 0 && (
                    <div className="flex items-start gap-2 text-sm text-yellow-600">
                      ⚠️ {t('overviewMode.missedNumbers')}: {currentSectionScore.numbers_missed.join(", ")}
                    </div>
                  )}
                  {currentSectionScore.feedback && (
                    <p className="text-sm text-muted-foreground pt-2 border-t">
                      {currentSectionScore.feedback}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Button onClick={handleNextSection} className="w-full" size="lg">
                {currentSectionIndex < topics.length - 1 ? (
                  <>
                    {t('overviewMode.nextSection')}
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  t('overviewMode.viewResults')
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recording Controls */}
        {(phase === 'practice' || phase === 'recording' || phase === 'processing') && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
            <div className="max-w-2xl mx-auto">
              {phase === 'processing' ? (
                <div className="flex items-center justify-center gap-3 py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-muted-foreground">{t('overviewMode.analyzing')}</span>
                </div>
              ) : (
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  size="lg"
                  className="w-full"
                >
                  {isRecording ? (
                    <>
                      <Square className="w-5 h-5 mr-2" />
                      {t('practice.stopRecording')}
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 mr-2" />
                      {t('overviewMode.explainThisSection')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OverviewPracticeView;
