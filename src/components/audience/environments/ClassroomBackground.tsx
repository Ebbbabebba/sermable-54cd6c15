import { motion } from "framer-motion";

export const ClassroomBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Wall base - warm classroom color */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-100 via-orange-50 to-amber-50 dark:from-amber-900/40 dark:via-orange-900/30 dark:to-amber-800/30" />
      
      {/* Chalkboard/Projector screen */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-48 h-20 bg-green-900 dark:bg-slate-800 rounded-sm shadow-lg border-4 border-amber-700 dark:border-slate-600">
        {/* Chalk marks */}
        <div className="absolute top-3 left-4 text-amber-100/60 dark:text-slate-400/60 text-[8px] font-mono">
          Today's Topic
        </div>
        <div className="absolute top-8 left-4 w-32 h-0.5 bg-amber-100/30 dark:bg-slate-400/30 rounded-full" />
        <div className="absolute top-10 left-4 w-24 h-0.5 bg-amber-100/20 dark:bg-slate-400/20 rounded-full" />
        <div className="absolute top-12 left-4 w-28 h-0.5 bg-amber-100/25 dark:bg-slate-400/25 rounded-full" />
        {/* Chalk tray */}
        <div className="absolute -bottom-2 left-4 right-4 h-2 bg-amber-600 dark:bg-slate-500 rounded-sm flex items-center justify-start gap-2 px-2">
          <div className="w-4 h-1 bg-white/80 rounded-full" />
          <div className="w-3 h-1 bg-yellow-200/80 rounded-full" />
        </div>
      </div>
      
      {/* Clock on wall */}
      <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white dark:bg-slate-200 shadow-md border-2 border-slate-300 dark:border-slate-400">
        {/* Clock face */}
        <div className="absolute top-1/2 left-1/2 w-0.5 h-2.5 bg-slate-800 origin-bottom -translate-x-1/2 -translate-y-1/2 -rotate-45" />
        <motion.div 
          className="absolute top-1/2 left-1/2 w-0.5 h-3 bg-slate-600 origin-bottom -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-slate-800 rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>
      
      {/* Educational poster left */}
      <div className="absolute top-6 left-2 w-10 h-14 bg-blue-100 dark:bg-blue-900/50 rounded-sm shadow-sm border border-blue-200 dark:border-blue-700">
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-300 dark:bg-blue-600" />
        <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
          <div className="w-full h-0.5 bg-blue-300 dark:bg-blue-600 rounded-full" />
          <div className="w-3/4 h-0.5 bg-blue-300 dark:bg-blue-600 rounded-full" />
        </div>
      </div>
      
      {/* Window with natural light */}
      <div className="absolute top-8 right-12 w-14 h-20 bg-sky-200 dark:bg-slate-600 rounded-sm border-4 border-amber-700 dark:border-slate-500 shadow-inner overflow-hidden">
        {/* Window panes */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-amber-700 dark:bg-slate-500" />
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-amber-700 dark:bg-slate-500" />
        {/* Sunlight effect */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-br from-yellow-200/40 to-transparent dark:from-slate-400/20"
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        {/* Trees/nature outside */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-green-400/50 dark:bg-green-800/50 rounded-t-full" />
      </div>
      
      {/* Bookshelf hint */}
      <div className="absolute bottom-16 right-2 w-8 h-12 bg-amber-700 dark:bg-amber-800 rounded-sm shadow-md">
        <div className="absolute top-1 left-0.5 right-0.5 h-2 bg-red-400 dark:bg-red-600 rounded-sm" />
        <div className="absolute top-4 left-0.5 right-0.5 h-2 bg-blue-400 dark:bg-blue-600 rounded-sm" />
        <div className="absolute top-7 left-0.5 right-0.5 h-2 bg-green-400 dark:bg-green-600 rounded-sm" />
      </div>
      
      {/* Student desk edges (foreground) */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-amber-600 to-amber-500 dark:from-amber-800 dark:to-amber-700 shadow-lg">
        {/* Desk surface reflection */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/20 to-transparent" />
        {/* Papers on desk */}
        <div className="absolute -top-2 left-8 w-5 h-4 bg-white dark:bg-slate-200 rounded-sm shadow-sm transform rotate-3" />
        <div className="absolute -top-2 left-10 w-5 h-4 bg-slate-100 dark:bg-slate-300 rounded-sm shadow-sm transform -rotate-2" />
        {/* Pencil */}
        <div className="absolute -top-1 right-12 w-8 h-1 bg-yellow-400 dark:bg-yellow-500 rounded-full transform rotate-12">
          <div className="absolute right-0 w-1 h-1 bg-amber-800 rounded-r-full" />
          <div className="absolute left-0 w-1.5 h-1 bg-pink-300 rounded-l-sm" />
        </div>
      </div>
      
      {/* Ambient classroom light */}
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-100/10 via-transparent to-amber-700/15 pointer-events-none" />
    </div>
  );
};
