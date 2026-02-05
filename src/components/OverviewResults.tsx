 import { useTranslation } from "react-i18next";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Progress } from "@/components/ui/progress";
 import { CheckCircle2, AlertCircle, XCircle, ArrowLeft, RotateCcw, Lightbulb } from "lucide-react";
 import { motion } from "framer-motion";
 
 interface Topic {
   id: string;
   topic_order: number;
   topic_title: string;
   key_points: string[];
 }
 
 interface OverviewResultsProps {
   topics: Topic[];
   topicsCovered: string[];
   topicsPartial: string[];
   topicsMissed: string[];
   overallScore: number;
   feedback: string;
   suggestions: string;
   onRetry: () => void;
   onBack: () => void;
 }
 
 export const OverviewResults = ({
   topics,
   topicsCovered,
   topicsPartial,
   topicsMissed,
   overallScore,
   feedback,
   suggestions,
   onRetry,
   onBack,
 }: OverviewResultsProps) => {
   const { t } = useTranslation();
 
   const getTopicById = (id: string) => topics.find(t => t.id === id);
 
   const getScoreColor = () => {
     if (overallScore >= 80) return "text-green-500";
     if (overallScore >= 50) return "text-yellow-500";
     return "text-red-500";
   };
 
   const getProgressColor = () => {
     if (overallScore >= 80) return "bg-green-500";
     if (overallScore >= 50) return "bg-yellow-500";
     return "bg-red-500";
   };
 
   return (
     <div className="min-h-screen p-4 pb-24">
       <div className="max-w-2xl mx-auto space-y-6">
         {/* Score Header */}
         <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="text-center py-8"
         >
           <div className={`text-6xl font-bold ${getScoreColor()}`}>
             {overallScore}%
           </div>
           <p className="text-muted-foreground mt-2">
             {t('overviewMode.contentCoverage')}
           </p>
           
           <div className="mt-4 max-w-xs mx-auto">
             <Progress 
               value={overallScore} 
               className="h-3"
             />
           </div>
         </motion.div>
 
         {/* Topic Coverage Grid */}
         <Card>
           <CardHeader>
             <CardTitle className="text-lg flex items-center gap-2">
               {t('overviewMode.topicCoverage')}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* Covered Topics */}
             {topicsCovered.length > 0 && (
               <div className="space-y-2">
                 <div className="flex items-center gap-2 text-green-500 font-medium">
                   <CheckCircle2 className="w-4 h-4" />
                   <span>{t('overviewMode.covered')}</span>
                 </div>
                 <div className="pl-6 space-y-1">
                   {topicsCovered.map(id => {
                     const topic = getTopicById(id);
                     return topic ? (
                       <div key={id} className="text-sm text-muted-foreground">
                         {topic.topic_order}. {topic.topic_title}
                       </div>
                     ) : null;
                   })}
                 </div>
               </div>
             )}
 
             {/* Partial Topics */}
             {topicsPartial.length > 0 && (
               <div className="space-y-2">
                 <div className="flex items-center gap-2 text-yellow-500 font-medium">
                   <AlertCircle className="w-4 h-4" />
                   <span>{t('overviewMode.partiallyCovered')}</span>
                 </div>
                 <div className="pl-6 space-y-1">
                   {topicsPartial.map(id => {
                     const topic = getTopicById(id);
                     return topic ? (
                       <div key={id} className="text-sm text-muted-foreground">
                         {topic.topic_order}. {topic.topic_title}
                       </div>
                     ) : null;
                   })}
                 </div>
               </div>
             )}
 
             {/* Missed Topics */}
             {topicsMissed.length > 0 && (
               <div className="space-y-2">
                 <div className="flex items-center gap-2 text-red-500 font-medium">
                   <XCircle className="w-4 h-4" />
                   <span>{t('overviewMode.missed')}</span>
                 </div>
                 <div className="pl-6 space-y-1">
                   {topicsMissed.map(id => {
                     const topic = getTopicById(id);
                     return topic ? (
                       <div key={id} className="text-sm text-muted-foreground">
                         {topic.topic_order}. {topic.topic_title}
                       </div>
                     ) : null;
                   })}
                 </div>
               </div>
             )}
           </CardContent>
         </Card>
 
         {/* AI Feedback */}
         <Card>
           <CardHeader>
             <CardTitle className="text-lg">
               {t('overviewMode.aiFeedback')}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <p className="text-foreground">{feedback}</p>
             
             {suggestions && (
               <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                 <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                 <p className="text-sm text-muted-foreground">{suggestions}</p>
               </div>
             )}
           </CardContent>
         </Card>
 
         {/* Action Buttons */}
         <div className="flex gap-3 pt-4">
           <Button
             variant="outline"
             onClick={onBack}
             className="flex-1"
           >
             <ArrowLeft className="w-4 h-4 mr-2" />
             {t('common.back')}
           </Button>
           <Button
             onClick={onRetry}
             className="flex-1"
           >
             <RotateCcw className="w-4 h-4 mr-2" />
             {t('overviewMode.tryAgain')}
           </Button>
         </div>
       </div>
     </div>
   );
 };
 
 export default OverviewResults;