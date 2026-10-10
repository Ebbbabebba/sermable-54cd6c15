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
    <div className="s-y7 s-qa s-56 s-6l s-6x s-mx s-2y">
      <h3 className="s-tw s-d3 s-u9 s-u0">
        {t("presentation.proximityTitle")}
      </h3>
      <p className="s-vj s-ul s-u0 s-lt">
        {t("presentation.proximitySubtitle")}
      </p>

      <div
        className="s-pd s-m9 s-lz"
        style={{ width: CONTAINER_WIDTH, height: 96 }}
      >
        {/* Distance zones */}
        <div
          className="s-26 s-w4 s-is s-9 s-qg s-5e"
          style={{ width: TWO_METERS_X, height: 32 }}
        />
        <div
          className="s-26 s-w4 s-9 s-qk s-4i"
          style={{ left: TWO_METERS_X, width: CONTAINER_WIDTH - TWO_METERS_X, height: 32 }}
        />

        {/* Center line */}
        <div className="s-26 s-w4 s-is s-pe s-gh s-4a s-9" />

        {/* Microphone at 0 m */}
        <div className="s-26 s-w4 s-is s-9 s-8 s-c5 s-c7 s-ib s-dl">
          <div className="s-mu s-qe s-3v s-6l s-6x s-r3">
            <Mic className="s-fz s-xt s-u9" />
          </div>
          <span className="s-tl s-ul s-d0">0 m</span>
        </div>

        {/* 1 m marker */}
        <div
          className="s-26 s-w4 s-9 s-c5 s-c7 s-ib s-dl"
          style={{ left: (1 / 3) * CONTAINER_WIDTH }}
        >
          <div className="s-y9 s-fw s-4a" />
          <span className="s-tl s-ul s-d0">1 m</span>
        </div>

        {/* 2 m marker */}
        <div
          className="s-26 s-w4 s-9 s-c5 s-c7 s-ib s-dl"
          style={{ left: TWO_METERS_X }}
        >
          <div className="s-y9 s-fz s-5c" />
          <span className="s-tl s-uw s-d3">2 m</span>
        </div>

        {/* 3 m marker */}
        <div
          className="s-26 s-w4 s-9 s-c5 s-c7 s-ib s-dl"
          style={{ left: CONTAINER_WIDTH }}
        >
          <div className="s-y9 s-fw s-4a" />
          <span className="s-tl s-ul s-d0">3 m</span>
        </div>

        {/* Moving person */}
        <motion.div
          className="s-26 s-w4 s-9 s-ye"
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
          <div className="s-mu s-qe s-3v s-6l s-73 s-r3 s-8">
            <User className="s-g1 s-xv" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
