import { motion } from "framer-motion";

export const InterviewBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Corporate wall base */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-gray-50 to-slate-100 dark:from-slate-800 dark:via-gray-800 dark:to-slate-700" />
      
      {/* Subtle wall texture/panels */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/3 w-0.5 h-full bg-slate-300 dark:bg-slate-600" />
        <div className="absolute top-0 left-2/3 w-0.5 h-full bg-slate-300 dark:bg-slate-600" />
      </div>
      
      {/* Company logo/art placeholder */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-8 bg-slate-200 dark:bg-slate-600 rounded-sm flex items-center justify-center shadow-sm">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-primary/30 rounded-sm" />
          <div className="w-10 h-2 bg-slate-300 dark:bg-slate-500 rounded-full" />
        </div>
      </div>
      
      {/* Framed certificate/diploma - left */}
      <div className="absolute top-6 left-3 w-10 h-12 bg-white dark:bg-slate-200 rounded-sm shadow-md border-2 border-amber-700 dark:border-amber-800">
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-slate-300 rounded-full" />
        <div className="absolute top-3 left-1 right-1 space-y-0.5">
          <div className="w-full h-0.5 bg-slate-200 rounded-full" />
          <div className="w-3/4 h-0.5 bg-slate-200 rounded-full" />
          <div className="w-full h-0.5 bg-slate-200 rounded-full" />
        </div>
        {/* Seal */}
        <div className="absolute bottom-1 right-1 w-3 h-3 bg-amber-500/30 rounded-full" />
      </div>
      
      {/* Framed certificate - right */}
      <div className="absolute top-8 right-3 w-8 h-10 bg-white dark:bg-slate-200 rounded-sm shadow-md border-2 border-slate-600 dark:border-slate-500">
        <div className="absolute inset-1 border border-slate-200 rounded-sm" />
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-slate-300 rounded-full" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-slate-300 rounded-full" />
      </div>
      
      {/* Potted plant - corner */}
      <div className="absolute bottom-16 right-2">
        {/* Pot */}
        <div className="w-5 h-6 bg-slate-400 dark:bg-slate-500 rounded-b-lg rounded-t-sm" />
        {/* Plant */}
        <motion.div 
          className="absolute -top-8 left-1/2 -translate-x-1/2"
          animate={{ rotate: [-1, 1, -1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-2 h-8 bg-green-600 dark:bg-green-700 rounded-full" />
          <div className="absolute top-0 -left-2 w-4 h-2 bg-green-500 dark:bg-green-600 rounded-full -rotate-45" />
          <div className="absolute top-2 left-1 w-4 h-2 bg-green-500 dark:bg-green-600 rounded-full rotate-45" />
          <div className="absolute top-4 -left-1 w-3 h-2 bg-green-400 dark:bg-green-500 rounded-full -rotate-30" />
        </motion.div>
      </div>
      
      {/* Interview desk/table */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-slate-700 to-slate-600 dark:from-slate-900 dark:to-slate-800 shadow-lg">
        {/* Desk surface */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-slate-500/50 to-transparent" />
        
        {/* Documents/clipboard */}
        <div className="absolute -top-3 left-6 w-8 h-6 bg-white dark:bg-slate-200 rounded-sm shadow-sm transform -rotate-3">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-slate-400 rounded-b-sm" />
          <div className="absolute top-2 left-1 right-1 space-y-0.5">
            <div className="w-full h-0.5 bg-slate-300 rounded-full" />
            <div className="w-3/4 h-0.5 bg-slate-300 rounded-full" />
            <div className="w-full h-0.5 bg-slate-300 rounded-full" />
          </div>
        </div>
        
        {/* Pen */}
        <div className="absolute -top-1 left-16 w-6 h-0.5 bg-slate-800 rounded-full transform rotate-12">
          <div className="absolute left-0 w-1 h-0.5 bg-slate-600" />
          <div className="absolute right-0 w-0.5 h-0.5 bg-amber-600 rounded-r-full" />
        </div>
        
        {/* Water glass */}
        <div className="absolute -top-4 right-8">
          <div className="w-3 h-4 bg-sky-100/50 dark:bg-sky-200/30 rounded-b-sm border border-slate-300/50">
            {/* Water level */}
            <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-sky-200/50 dark:bg-sky-300/30 rounded-b-sm" />
          </div>
        </div>
        
        {/* Laptop/tablet hint */}
        <div className="absolute -top-3 right-16 w-10 h-6 bg-slate-300 dark:bg-slate-400 rounded-sm shadow-sm">
          <div className="absolute inset-0.5 bg-slate-800 dark:bg-slate-900 rounded-sm">
            {/* Screen content */}
            <div className="absolute top-1 left-1 w-3 h-0.5 bg-primary/40 rounded-full" />
            <div className="absolute top-2 left-1 w-5 h-0.5 bg-slate-600 rounded-full" />
          </div>
        </div>
      </div>
      
      {/* Subtle professional lighting */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      
      {/* Ambient corporate feel */}
      <motion.div 
        className="absolute inset-0 bg-gradient-radial from-slate-200/10 via-transparent to-slate-400/5 pointer-events-none"
        animate={{ opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
    </div>
  );
};
