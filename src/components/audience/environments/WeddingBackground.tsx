import { motion } from "framer-motion";

export const WeddingBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Elegant venue base */}
      <div className="absolute inset-0 bg-gradient-to-b from-rose-50 via-pink-50 to-rose-100 dark:from-rose-950/40 dark:via-pink-950/30 dark:to-rose-900/40" />
      
      {/* Decorative draping - top */}
      <div className="absolute top-0 left-0 right-0 h-8">
        <svg className="w-full h-full" viewBox="0 0 200 20" preserveAspectRatio="none">
          <path 
            d="M0,0 Q25,15 50,10 Q75,5 100,12 Q125,18 150,8 Q175,0 200,10 L200,0 L0,0 Z" 
            fill="currentColor" 
            className="text-rose-200 dark:text-rose-800/50"
          />
        </svg>
        {/* Gold trim */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300" />
      </div>
      
      {/* Chandelier */}
      <motion.div 
        className="absolute top-2 left-1/2 -translate-x-1/2"
        animate={{ rotate: [-1, 1, -1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Chain */}
        <div className="w-0.5 h-3 bg-yellow-600 mx-auto" />
        {/* Body */}
        <div className="w-16 h-6 bg-gradient-to-b from-yellow-400 to-yellow-500 rounded-b-full relative">
          {/* Crystals */}
          <motion.div 
            className="absolute -bottom-2 left-1 w-1 h-3 bg-white/80 rounded-full"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-4 bg-white/80 rounded-full"
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -bottom-2 right-1 w-1 h-3 bg-white/80 rounded-full"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
          {/* Candles */}
          <div className="absolute -top-1 left-2 w-1 h-2 bg-rose-100 rounded-t-sm">
            <motion.div 
              className="absolute -top-1 left-0 w-1 h-1 bg-yellow-300 rounded-full blur-[1px]"
              animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </div>
          <div className="absolute -top-1 right-2 w-1 h-2 bg-rose-100 rounded-t-sm">
            <motion.div 
              className="absolute -top-1 left-0 w-1 h-1 bg-yellow-300 rounded-full blur-[1px]"
              animate={{ scale: [1.2, 1, 1.2], opacity: [1, 0.8, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </div>
        </div>
      </motion.div>
      
      {/* Floral arrangements - left */}
      <div className="absolute top-12 left-2">
        <div className="relative">
          {/* Vase */}
          <div className="w-6 h-8 bg-gradient-to-b from-rose-300 to-rose-400 rounded-b-lg rounded-t-sm mx-auto" />
          {/* Flowers */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <motion.div 
              className="absolute -left-3 top-0 w-4 h-4 bg-pink-300 rounded-full"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div 
              className="absolute left-0 -top-2 w-5 h-5 bg-rose-400 rounded-full"
              animate={{ scale: [1.05, 1, 1.05] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <motion.div 
              className="absolute left-2 top-0 w-4 h-4 bg-pink-200 rounded-full"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
            />
            {/* Leaves */}
            <div className="absolute -left-4 top-2 w-3 h-2 bg-green-400 rounded-full -rotate-45" />
            <div className="absolute left-4 top-2 w-3 h-2 bg-green-500 rounded-full rotate-45" />
          </div>
        </div>
      </div>
      
      {/* Floral arrangements - right */}
      <div className="absolute top-12 right-2">
        <div className="relative">
          <div className="w-6 h-8 bg-gradient-to-b from-rose-300 to-rose-400 rounded-b-lg rounded-t-sm mx-auto" />
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <motion.div 
              className="absolute -left-2 -top-1 w-4 h-4 bg-rose-300 rounded-full"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div 
              className="absolute left-0 -top-3 w-5 h-5 bg-pink-400 rounded-full"
              animate={{ scale: [1.05, 1, 1.05] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.3 }}
            />
            <motion.div 
              className="absolute left-3 top-0 w-4 h-4 bg-rose-200 rounded-full"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: 0.8 }}
            />
            <div className="absolute -left-3 top-2 w-3 h-2 bg-green-500 rounded-full -rotate-45" />
            <div className="absolute left-5 top-1 w-3 h-2 bg-green-400 rounded-full rotate-45" />
          </div>
        </div>
      </div>
      
      {/* Ribbon decorations */}
      <div className="absolute top-6 left-8">
        <svg width="20" height="30" viewBox="0 0 20 30">
          <path 
            d="M10,0 Q15,10 10,15 Q5,20 10,30" 
            stroke="currentColor" 
            strokeWidth="2" 
            fill="none"
            className="text-rose-300"
          />
        </svg>
      </div>
      <div className="absolute top-6 right-8">
        <svg width="20" height="30" viewBox="0 0 20 30">
          <path 
            d="M10,0 Q5,10 10,15 Q15,20 10,30" 
            stroke="currentColor" 
            strokeWidth="2" 
            fill="none"
            className="text-rose-300"
          />
        </svg>
      </div>
      
      {/* Elegant table (foreground) */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-rose-100 to-white dark:from-rose-900/50 dark:to-rose-800/30 shadow-lg">
        {/* Tablecloth drape */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-b from-rose-200/50 to-transparent" />
        {/* Lace edge */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/50 rounded-b-full" style={{ margin: '0 1px' }} />
          ))}
        </div>
        {/* Wine glasses */}
        <div className="absolute -top-4 left-10">
          <div className="w-2 h-3 bg-transparent border border-rose-300/50 rounded-t-full" />
          <div className="w-0.5 h-2 bg-rose-300/50 mx-auto" />
          <div className="w-3 h-0.5 bg-rose-300/50 rounded-full" />
        </div>
        <div className="absolute -top-4 right-10">
          <div className="w-2 h-3 bg-transparent border border-rose-300/50 rounded-t-full" />
          <div className="w-0.5 h-2 bg-rose-300/50 mx-auto" />
          <div className="w-3 h-0.5 bg-rose-300/50 rounded-full" />
        </div>
      </div>
      
      {/* Romantic ambient glow */}
      <motion.div 
        className="absolute inset-0 bg-gradient-radial from-rose-200/20 via-transparent to-rose-300/10 pointer-events-none"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      
      {/* Floating petals */}
      <motion.div 
        className="absolute top-20 left-1/4 w-2 h-2 bg-rose-300 rounded-full opacity-40"
        animate={{ 
          y: [0, 40, 0],
          x: [0, 10, 0],
          rotate: [0, 180, 360]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute top-16 right-1/3 w-1.5 h-1.5 bg-pink-300 rounded-full opacity-30"
        animate={{ 
          y: [0, 50, 0],
          x: [0, -8, 0],
          rotate: [0, -180, -360]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
    </div>
  );
};
