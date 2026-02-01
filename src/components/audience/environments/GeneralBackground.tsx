import { motion } from "framer-motion";

export const GeneralBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Clean modern base */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600" />
      
      {/* Subtle geometric pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <circle cx="5" cy="5" r="1" fill="currentColor" className="text-slate-900 dark:text-slate-100" />
          </pattern>
          <rect width="100" height="100" fill="url(#grid)" />
        </svg>
      </div>
      
      {/* Abstract art/decoration - left */}
      <div className="absolute top-6 left-4 w-12 h-16 rounded-lg overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/20 to-accent/20" />
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-secondary/40 to-transparent" />
        <motion.div 
          className="absolute top-2 left-2 w-4 h-4 bg-primary/40 rounded-full"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <div className="absolute bottom-2 right-2 w-6 h-6 border-2 border-accent/30 rounded-sm transform rotate-12" />
      </div>
      
      {/* Abstract art - right */}
      <div className="absolute top-8 right-4 w-10 h-12 rounded-sm overflow-hidden shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-tl from-accent/30 via-secondary/20 to-primary/20" />
        <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-primary/20 to-transparent" />
        <motion.div 
          className="absolute bottom-3 left-1/2 -translate-x-1/2 w-5 h-1 bg-accent/40 rounded-full"
          animate={{ scaleX: [1, 1.2, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>
      
      {/* Modern pendant light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div className="w-0.5 h-4 bg-slate-400 dark:bg-slate-500 mx-auto" />
        <motion.div 
          className="w-10 h-4 bg-gradient-to-b from-slate-300 to-slate-400 dark:from-slate-500 dark:to-slate-600 rounded-b-full"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1 bg-yellow-200/50 rounded-full blur-sm" />
        </motion.div>
      </div>
      
      {/* Simple plant */}
      <div className="absolute bottom-16 left-3">
        <div className="w-4 h-4 bg-slate-300 dark:bg-slate-500 rounded-b-lg rounded-t-sm" />
        <motion.div 
          className="absolute -top-4 left-1/2 -translate-x-1/2"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-1.5 h-5 bg-green-500 dark:bg-green-600 rounded-full" />
          <div className="absolute top-0 -left-1 w-2 h-1.5 bg-green-400 dark:bg-green-500 rounded-full -rotate-30" />
          <div className="absolute top-2 left-1 w-2 h-1.5 bg-green-400 dark:bg-green-500 rounded-full rotate-30" />
        </motion.div>
      </div>
      
      {/* Clean modern surface (foreground) */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-600 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
      
      {/* Clean ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-slate-300/10 pointer-events-none" />
    </div>
  );
};
