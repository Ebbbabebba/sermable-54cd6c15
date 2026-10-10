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
          className="s-c4 s-iw s-yh s-c5 s-ib s-dp s-q9 s-4i s-6l s-77 s-3f s-os s-p6 s-qx"
          style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 1.25rem)" }}
        >
          <div className="s-pd s-c5 s-ib s-ig">
            <div className="s-mu s-qe s-4h s-u3">
              <Mic className="s-fz s-xt" />
            </div>
            <motion.span
              className="s-26 s-i5 s-qe s-4l"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="s-26 s-i5 s-qe s-4k"
              animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.35,
              }}
            />
          </div>

          <div className="s-c5 s-c7">
            <span className="s-v9 s-d3 s-u2">
              {t("presentation.moveCloser")}
            </span>
            <span className="s-vj s-u4">
              {t("presentation.proximityTitle")}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
