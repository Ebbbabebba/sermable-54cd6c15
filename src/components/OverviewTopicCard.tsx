 import { cn } from "@/lib/utils";
 import { Card } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import { CheckCircle2, Circle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
 import { useState } from "react";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
 import { motion, AnimatePresence } from "framer-motion";
 
 interface OverviewTopicCardProps {
   topicOrder: number;
   topicTitle: string;
   keyPoints: string[];
   hintLevel: 1 | 2 | 3; // 1=full, 2=title only, 3=number only
   coverageStatus?: 'covered' | 'partial' | 'missed' | null;
   lastScore?: number | null;
   className?: string;
 }
 
 export const OverviewTopicCard = ({
   topicOrder,
   topicTitle,
   keyPoints,
   hintLevel,
   coverageStatus,
   lastScore,
   className,
 }: OverviewTopicCardProps) => {
   const [isExpanded, setIsExpanded] = useState(hintLevel === 1);
 
   const getStatusIcon = () => {
     if (!coverageStatus) return <Circle className="w-5 h-5 text-muted-foreground" />;
     switch (coverageStatus) {
       case 'covered':
         return <CheckCircle2 className="w-5 h-5 text-green-500" />;
       case 'partial':
         return <AlertCircle className="w-5 h-5 text-yellow-500" />;
       case 'missed':
         return <Circle className="w-5 h-5 text-red-500" />;
     }
   };
 
   const getStatusColor = () => {
     if (!coverageStatus) return "border-border";
     switch (coverageStatus) {
       case 'covered':
         return "border-green-500/50 bg-green-500/5";
       case 'partial':
         return "border-yellow-500/50 bg-yellow-500/5";
       case 'missed':
         return "border-red-500/50 bg-red-500/5";
     }
   };
 
   // Progressive hint display
   const showTitle = hintLevel <= 2;
   const showKeyPoints = hintLevel === 1;
 
   return (
     <motion.div
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.3, delay: topicOrder * 0.1 }}
     >
       <Card className={cn(
         "p-4 transition-all duration-300 border-2",
         getStatusColor(),
         className
       )}>
         <Collapsible open={isExpanded && showKeyPoints} onOpenChange={setIsExpanded}>
           <div className="flex items-start justify-between gap-3">
             <div className="flex items-start gap-3 flex-1">
               <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                 {topicOrder}
               </div>
               
               <div className="flex-1 min-w-0">
                 {showTitle ? (
                   <h3 className="font-semibold text-foreground leading-tight">
                     {topicTitle}
                   </h3>
                 ) : (
                   <h3 className="font-semibold text-muted-foreground leading-tight italic">
                     Topic {topicOrder}
                   </h3>
                 )}
                 
                 {lastScore !== null && lastScore !== undefined && (
                   <Badge variant="secondary" className="mt-1 text-xs">
                     {lastScore}% last session
                   </Badge>
                 )}
               </div>
             </div>
 
             <div className="flex items-center gap-2">
               {getStatusIcon()}
               
               {showKeyPoints && keyPoints.length > 0 && (
                 <CollapsibleTrigger className="p-1 hover:bg-accent rounded-md transition-colors">
                   {isExpanded ? (
                     <ChevronUp className="w-4 h-4 text-muted-foreground" />
                   ) : (
                     <ChevronDown className="w-4 h-4 text-muted-foreground" />
                   )}
                 </CollapsibleTrigger>
               )}
             </div>
           </div>
 
           <AnimatePresence>
             {showKeyPoints && (
               <CollapsibleContent>
                 <motion.ul
                   initial={{ opacity: 0, height: 0 }}
                   animate={{ opacity: 1, height: "auto" }}
                   exit={{ opacity: 0, height: 0 }}
                   className="mt-3 ml-11 space-y-1.5"
                 >
                   {keyPoints.map((point, index) => (
                     <li 
                       key={index}
                       className="flex items-start gap-2 text-sm text-muted-foreground"
                     >
                       <span className="text-primary mt-1">•</span>
                       <span>{point}</span>
                     </li>
                   ))}
                 </motion.ul>
               </CollapsibleContent>
             )}
           </AnimatePresence>
         </Collapsible>
       </Card>
     </motion.div>
   );
 };
 
 export default OverviewTopicCard;