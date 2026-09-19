import AnimalAudience from "@/components/AnimalAudience";

const Cell = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="relative h-72 w-56 overflow-hidden rounded-2xl border border-border bg-background">{children}</div>
    <span className="text-xs text-muted-foreground">{label}</span>
  </div>
);

/** TEMP dev-only preview of the animal audience variants. */
const DevAnimals = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="flex flex-wrap gap-6">
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <Cell key={`m-${v}`} label={`variant ${v} mood mid`}>
          <div className="absolute inset-4">
            <AnimalAudiencePreview variant={v} progress={0.4} />
          </div>
        </Cell>
      ))}
      {[0, 1, 2, 3, 4, 5].map((v) => (
        <Cell key={`c-${v}`} label={`variant ${v} celebrating`}>
          <div className="absolute inset-4">
            <AnimalAudiencePreview variant={v} progress={1} celebrating />
          </div>
        </Cell>
      ))}
    </div>
  </div>
);

// Renders only the SVG character (not the full-screen overlay) for quick review.
import { useMemo } from "react";
const AnimalAudiencePreview = ({ variant, progress, celebrating = false }: { variant: number; progress: number; celebrating?: boolean }) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const Comp = useMemo(() => AnimalAudience, []);
  return (
    <div className="relative h-full w-full">
      {/* Use the real overlay scaled down via transform for accuracy */}
      <div className="absolute inset-0 origin-top-left" style={{ transform: "scale(1)", width: "100%", height: "100%" }}>
        <Comp progress={progress} celebrating={celebrating} variant={variant} doneLabel="Klar!" promptLabel="Säg meningen" />
      </div>
    </div>
  );
};

export default DevAnimals;
