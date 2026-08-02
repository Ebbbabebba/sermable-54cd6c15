import { useTranslation } from "react-i18next";
import { Mic } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface ProximityWarningProps {
  isVisible: boolean;
}

export function ProximityWarning({ isVisible }: ProximityWarningProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed left-4 z-50 flex items-center gap-3 rounded-2xl bg-destructive/10 border border-destructive/30 backdrop-blur-md px-4 py-3 shadow-lg"
          style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 1.25rem)" }}
        >
          <div className="relative flex items-center justify-center">
            <div className="p-2 rounded-full bg-destructive text-destructive-foreground">
              <Mic className="h-4 w-4" />
            </div>
            <motion.span
              className="absolute inset-0 rounded-full bg-destructive/30"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-0 rounded-full bg-destructive/20"
              animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.35,
              }}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold text-destructive">
              {t("presentation.moveCloser")}
            </span>
            <span className="text-xs text-destructive/80">
              {t("presentation.proximityTitle")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
