 import { useState, useEffect, useRef } from "react";
 import { useTranslation } from "react-i18next";
 import { useNavigate } from "react-router-dom";
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
   original_section: string | null;
   is_mastered: boolean;
   practice_count: number;
   last_coverage_score: number | null;
 }
 
 interface OverviewPracticeViewProps {
   speechId: string;
   speechTitle: string;
   speechText: string;
   speechLanguage: string;
   onBack: () => void;
 }
 
 type Phase = 'read' | 'practice' | 'recording' | 'processing' | 'results';
 
 export const OverviewPracticeView = ({
   speechId,
   speechTitle,
   speechText,
   speechLanguage,
   onBack,
 }: OverviewPracticeViewProps) => {
   const { t } = useTranslation();
   const { toast } = useToast();
   const navigate = useNavigate();
   const audioRecorderRef = useRef<AudioRecorderHandle>(null);
 
   const [topics, setTopics] = useState<Topic[]>([]);
   const [loading, setLoading] = useState(true);
   const [phase, setPhase] = useState<Phase>('read');
   const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
   const [isRecording, setIsRecording] = useState(false);
   const [transcription, setTranscription] = useState("");
 
   // Results state
   const [results, setResults] = useState<{
     topicsCovered: string[];
     topicsPartial: string[];
     topicsMissed: string[];
     overallScore: number;
     feedback: string;
     suggestions: string;
   } | null>(null);
 
   // Load or extract topics
   useEffect(() => {
     loadTopics();
   }, [speechId]);
 
   const loadTopics = async () => {
     setLoading(true);
     try {
       // First try to load existing topics
       const { data: existingTopics, error } = await supabase
         .from("overview_topics")
         .select("*")
         .eq("speech_id", speechId)
         .order("topic_order", { ascending: true });
 
       if (error) throw error;
 
       if (existingTopics && existingTopics.length > 0) {
         setTopics(existingTopics);
         
         // Determine hint level based on practice history
         const avgPracticeCount = existingTopics.reduce((sum, t) => sum + (t.practice_count || 0), 0) / existingTopics.length;
         if (avgPracticeCount >= 5) {
           setHintLevel(3); // Numbers only
         } else if (avgPracticeCount >= 2) {
           setHintLevel(2); // Titles only
         } else {
           setHintLevel(1); // Full hints
         }
       } else {
         // Extract topics using AI
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
         body: {
           speechId,
           speechText,
           speechLanguage,
         }
       });
 
       if (error) throw error;
 
       if (data?.topics) {
         setTopics(data.topics);
         toast({
           title: t('overviewMode.topicsExtracted'),
           description: t('overviewMode.topicsExtractedDesc', { count: data.topics.length }),
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
 
   const startRecording = () => {
     setPhase('recording');
     setIsRecording(true);
     audioRecorderRef.current?.startRecording();
   };
 
   const stopRecording = () => {
     setIsRecording(false);
     audioRecorderRef.current?.stopRecording();
   };
 
   const handleRecordingComplete = async (audioBlob: Blob) => {
     setPhase('processing');
     
     try {
       // Convert blob to base64
       const reader = new FileReader();
       reader.readAsDataURL(audioBlob);
       
       reader.onloadend = async () => {
         const base64Audio = reader.result as string;
         
         // Transcribe audio
         const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
           body: {
             audio: base64Audio,
             language: speechLanguage,
           }
         });
 
         if (transcribeError) throw transcribeError;
 
         const userTranscription = transcribeData?.text || "";
         setTranscription(userTranscription);
 
         if (!userTranscription.trim()) {
           toast({
             variant: "destructive",
             title: t('overviewMode.noSpeechDetected'),
             description: t('overviewMode.tryAgainLouder'),
           });
           setPhase('practice');
           return;
         }
 
         // Analyze session
         const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-overview-session', {
           body: {
             speechId,
             transcription: userTranscription,
             topics,
             speechLanguage,
             hintLevel,
           }
         });
 
         if (analysisError) throw analysisError;
 
         const analysis = analysisData?.analysis;
         if (analysis) {
           setResults({
             topicsCovered: analysis.topics_covered || [],
             topicsPartial: analysis.topics_partially_covered || [],
             topicsMissed: analysis.topics_missed || [],
             overallScore: analysis.overall_score || 0,
             feedback: analysis.feedback || "",
             suggestions: analysis.suggestions || "",
           });
           setPhase('results');
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
 
   const handleRetry = () => {
     setResults(null);
     setTranscription("");
     setPhase('practice');
   };
 
   const toggleHintLevel = () => {
     setHintLevel(prev => {
       if (prev === 1) return 2;
       if (prev === 2) return 3;
       return 1;
     });
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
 
   if (phase === 'results' && results) {
     return (
       <OverviewResults
         topics={topics}
         topicsCovered={results.topicsCovered}
         topicsPartial={results.topicsPartial}
         topicsMissed={results.topicsMissed}
         overallScore={results.overallScore}
         feedback={results.feedback}
         suggestions={results.suggestions}
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
 
         {/* Phase: Read Through */}
         <AnimatePresence mode="wait">
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
 
           {/* Phase: Practice / Recording / Processing */}
           {(phase === 'practice' || phase === 'recording' || phase === 'processing') && (
             <motion.div
               key="practice"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               className="space-y-4"
             >
               <div className="text-center text-sm text-muted-foreground mb-4">
                 {t('overviewMode.speakAboutTopics')}
               </div>
 
               {/* Topic Cards */}
               <div className="space-y-3">
                 {topics.map((topic) => (
                   <OverviewTopicCard
                     key={topic.id}
                     topicOrder={topic.topic_order}
                     topicTitle={topic.topic_title}
                     keyPoints={topic.key_points}
                     hintLevel={hintLevel}
                     lastScore={topic.last_coverage_score}
                   />
                 ))}
               </div>
             </motion.div>
           )}
         </AnimatePresence>
 
         {/* Recording Controls - Fixed at bottom */}
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
                       {t('practice.startRecording')}
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