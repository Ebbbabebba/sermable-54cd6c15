import { Animal, ANIMALS } from "@/components/AnimalAudience";

/** TEMP dev-only preview of the animal characters. */
const DevAnimals = () => (
  <div className="min-h-screen bg-background p-6">
    <div className="flex flex-wrap gap-6">
      {ANIMALS.map((a, i) => (
        <div key={`m-${i}`} className="flex flex-col items-center gap-2">
          <div className="h-72 w-56 rounded-2xl border border-border bg-background p-4">
            <Animal kind={a.kind} palette={a.palette} mood={0.4} celebrating={false} />
          </div>
          <span className="text-xs text-muted-foreground">{a.kind} · mood 0.4</span>
        </div>
      ))}
      {ANIMALS.map((a, i) => (
        <div key={`c-${i}`} className="flex flex-col items-center gap-2">
          <div className="h-72 w-56 rounded-2xl border border-border bg-background p-4">
            <Animal kind={a.kind} palette={a.palette} mood={1} celebrating />
          </div>
          <span className="text-xs text-muted-foreground">{a.kind} · celebrating</span>
        </div>
      ))}
    </div>
  </div>
);

export default DevAnimals;
