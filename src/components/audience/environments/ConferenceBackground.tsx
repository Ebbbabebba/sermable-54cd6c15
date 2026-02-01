import { motion } from "framer-motion";

export const ConferenceBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Dark venue base */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950" />
      
      {/* Stage curtains - left */}
      <div className="absolute top-0 left-0 w-8 h-full bg-gradient-to-r from-red-900 to-red-800 dark:from-red-950 dark:to-red-900">
        {/* Curtain folds */}
        <div className="absolute inset-0 flex flex-col">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className="flex-1 bg-gradient-to-r from-red-950/50 to-transparent"
              style={{ opacity: i % 2 === 0 ? 0.3 : 0.1 }}
            />
          ))}
        </div>
        {/* Gold trim */}
        <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-yellow-500 via-yellow-600 to-yellow-700" />
      </div>
      
      {/* Stage curtains - right */}
      <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-red-900 to-red-800 dark:from-red-950 dark:to-red-900">
        {/* Curtain folds */}
        <div className="absolute inset-0 flex flex-col">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className="flex-1 bg-gradient-to-l from-red-950/50 to-transparent"
              style={{ opacity: i % 2 === 0 ? 0.3 : 0.1 }}
            />
          ))}
        </div>
        {/* Gold trim */}
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-yellow-500 via-yellow-600 to-yellow-700" />
      </div>
      
      {/* Curtain valance (top) */}
      <div className="absolute top-0 left-6 right-6 h-6 bg-gradient-to-b from-red-800 to-red-900">
        {/* Scalloped bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center">
          {[...Array(8)].map((_, i) => (
            <div 
              key={i} 
              className="w-8 h-3 bg-red-900 rounded-b-full"
            />
          ))}
        </div>
        {/* Gold fringe */}
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-yellow-600 via-yellow-500 to-yellow-600" />
      </div>
      
      {/* Stage spotlights */}
      <motion.div 
        className="absolute top-0 left-1/4 w-32 h-48"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="w-full h-full bg-gradient-to-b from-yellow-300/30 via-yellow-200/10 to-transparent"
          style={{ clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)' }}
        />
      </motion.div>
      
      <motion.div 
        className="absolute top-0 right-1/4 w-32 h-48"
        animate={{ opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="w-full h-full bg-gradient-to-b from-blue-300/30 via-blue-200/10 to-transparent"
          style={{ clipPath: 'polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)' }}
        />
      </motion.div>
      
      {/* Center spotlight */}
      <motion.div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-56"
        animate={{ opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <div className="w-full h-full bg-gradient-to-b from-white/20 via-white/5 to-transparent"
          style={{ clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }}
        />
      </motion.div>
      
      {/* Audience silhouettes in background */}
      <div className="absolute bottom-20 left-10 right-10 h-8 flex items-end justify-center gap-1 opacity-20">
        {[...Array(12)].map((_, i) => (
          <div 
            key={i} 
            className="w-4 h-3 bg-slate-400 rounded-t-full"
            style={{ height: `${8 + Math.random() * 6}px` }}
          />
        ))}
      </div>
      <div className="absolute bottom-14 left-6 right-6 h-6 flex items-end justify-center gap-1 opacity-15">
        {[...Array(16)].map((_, i) => (
          <div 
            key={i} 
            className="w-3 h-2 bg-slate-500 rounded-t-full"
            style={{ height: `${6 + Math.random() * 4}px` }}
          />
        ))}
      </div>
      
      {/* Podium/stage floor edge */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-800 to-slate-900 shadow-lg">
        {/* Stage floor */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-900/30 via-amber-800/40 to-amber-900/30" />
        {/* Podium hint */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-6 bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-sm shadow-lg">
          <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-2 bg-slate-400 rounded-full" />
        </div>
      </div>
      
      {/* Venue ambient glow */}
      <div className="absolute inset-0 bg-gradient-radial from-indigo-500/5 via-transparent to-slate-950/50 pointer-events-none" />
    </div>
  );
};
