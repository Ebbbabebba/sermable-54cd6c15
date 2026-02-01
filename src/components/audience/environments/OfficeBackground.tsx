import { motion } from "framer-motion";

export const OfficeBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Wall base */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-50 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600" />
      
      {/* Window with city view */}
      <div className="absolute top-4 right-4 w-32 h-24 rounded-sm overflow-hidden border-4 border-slate-300 dark:border-slate-500 shadow-lg">
        {/* Sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 to-sky-100 dark:from-slate-600 dark:to-slate-500" />
        {/* Sun/Moon */}
        <motion.div 
          className="absolute top-2 right-3 w-6 h-6 rounded-full bg-yellow-200 dark:bg-slate-300 blur-[1px]"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        {/* City buildings */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-1 px-1">
          <div className="w-4 h-8 bg-slate-400 dark:bg-slate-700 rounded-t-sm" />
          <div className="w-5 h-12 bg-slate-500 dark:bg-slate-600 rounded-t-sm" />
          <div className="w-3 h-6 bg-slate-400 dark:bg-slate-700 rounded-t-sm" />
          <div className="w-6 h-10 bg-slate-500 dark:bg-slate-600 rounded-t-sm" />
          <div className="w-4 h-7 bg-slate-400 dark:bg-slate-700 rounded-t-sm" />
        </div>
        {/* Window reflection */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
      </div>
      
      {/* Whiteboard */}
      <div className="absolute top-3 left-4 w-28 h-16 bg-white dark:bg-slate-200 rounded-sm shadow-md border border-slate-300">
        {/* Whiteboard content - simple chart */}
        <div className="absolute bottom-2 left-2 right-2 flex items-end gap-1">
          <div className="w-3 h-4 bg-primary/40 rounded-t-sm" />
          <div className="w-3 h-6 bg-primary/50 rounded-t-sm" />
          <div className="w-3 h-8 bg-primary/60 rounded-t-sm" />
          <div className="w-3 h-5 bg-primary/50 rounded-t-sm" />
          <div className="w-3 h-7 bg-primary/55 rounded-t-sm" />
        </div>
        {/* Marker tray */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-2 bg-slate-200 dark:bg-slate-400 rounded-sm" />
      </div>
      
      {/* Office plant */}
      <div className="absolute bottom-16 left-2">
        {/* Pot */}
        <div className="w-6 h-5 bg-amber-600 dark:bg-amber-700 rounded-b-lg rounded-t-sm" />
        {/* Leaves */}
        <motion.div 
          className="absolute -top-6 left-1/2 -translate-x-1/2"
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-3 h-6 bg-green-500 dark:bg-green-600 rounded-full -rotate-12 origin-bottom" />
          <div className="absolute top-0 left-1 w-3 h-7 bg-green-600 dark:bg-green-700 rounded-full rotate-12 origin-bottom" />
          <div className="absolute top-1 left-0 w-2 h-5 bg-green-400 dark:bg-green-500 rounded-full -rotate-30 origin-bottom" />
        </motion.div>
      </div>
      
      {/* Ceiling lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-12">
        <motion.div 
          className="w-16 h-2 bg-white/80 dark:bg-white/40 rounded-b-full shadow-lg"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div 
          className="w-16 h-2 bg-white/80 dark:bg-white/40 rounded-b-full shadow-lg"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      </div>
      
      {/* Conference table (foreground) */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-amber-800 to-amber-700 dark:from-amber-900 dark:to-amber-800 rounded-t-lg shadow-lg">
        {/* Table reflection */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-white/20 to-transparent rounded-t-lg" />
        {/* Coffee cup */}
        <div className="absolute -top-4 right-8">
          <div className="w-4 h-4 bg-white dark:bg-slate-200 rounded-b-lg rounded-t-sm shadow-sm" />
          <div className="absolute top-0.5 right-0 w-1.5 h-2 border border-slate-300 dark:border-slate-400 rounded-r-full" />
          {/* Steam */}
          <motion.div 
            className="absolute -top-2 left-1 w-0.5 h-2 bg-slate-300/50 rounded-full"
            animate={{ y: [-2, -4], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>
        {/* Notebook */}
        <div className="absolute -top-3 left-6 w-6 h-4 bg-slate-100 dark:bg-slate-300 rounded-sm shadow-sm transform -rotate-6">
          <div className="absolute top-1 left-1 w-4 h-0.5 bg-slate-300 dark:bg-slate-400 rounded-full" />
          <div className="absolute top-2 left-1 w-3 h-0.5 bg-slate-300 dark:bg-slate-400 rounded-full" />
        </div>
      </div>
      
      {/* Ambient light overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-amber-900/10 pointer-events-none" />
    </div>
  );
};
