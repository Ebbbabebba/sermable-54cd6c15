import { useTranslation } from "react-i18next";
import { Mic, User } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";

const CONTAINER_WIDTH = 288; // px
const TWO_METERS_X = (2 / 3) * CONTAINER_WIDTH;

export function ProximityGuide() {
  const { t } = useTranslation();
  const x = useMotionValue(20);
  const color = useTransform(
    x,
    [0, TWO_METERS_X, CONTAINER_WIDTH - 16],
    [
      "hsl(var(--primary))",
      "hsl(var(--primary))",
      "hsl(var(--destructive))",
    ]
  );

  return (
    <div className="w-full rounded-3xl bg-muted/50 border border-border p-5 animate-fade-in">
      <h3 className="text-base font-semibold text-foreground text-center">
        {t("presentation.proximityTitle")}
      </h3>
      <p className="text-xs text-muted-foreground text-center mt-1">
        {t("presentation.proximitySubtitle")}
      </p>

      <div
        className="relative mx-auto mt-5"
        style={{ width: CONTAINER_WIDTH, height: 96 }}
      >
        {/* Distance zones */}
        <div
          className="absolute top-1/2 left-0 -translate-y-1/2 rounded-l-xl bg-primary/10"
          style={{ width: TWO_METERS_X, height: 32 }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-r-xl bg-destructive/10"
          style={{ left: TWO_METERS_X, width: CONTAINER_WIDTH - TWO_METERS_X, height: 32 }}
        />

        {/* Center line */}
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-1/2" />

        {/* Microphone at 0 m */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="p-2 rounded-full bg-background border border-border shadow-sm">
            <Mic className="h-4 w-4 text-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">0 m</span>
        </div>

        {/* 1 m marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          style={{ left: (1 / 3) * CONTAINER_WIDTH }}
        >
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] text-muted-foreground font-medium">1 m</span>
        </div>

        {/* 2 m marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          style={{ left: TWO_METERS_X }}
        >
          <div className="w-px h-4 bg-primary" />
          <span className="text-[10px] text-primary font-semibold">2 m</span>
        </div>

        {/* 3 m marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
          style={{ left: CONTAINER_WIDTH }}
        >
          <div className="w-px h-3 bg-border" />
          <span className="text-[10px] text-muted-foreground font-medium">3 m</span>
        </div>

        {/* Moving person */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 z-10"
          style={{ x, color }}
          animate={{
            x: [20, CONTAINER_WIDTH - 16, 20],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="p-2 rounded-full bg-background border border-current shadow-sm -translate-x-1/2">
            <User className="h-5 w-5" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
