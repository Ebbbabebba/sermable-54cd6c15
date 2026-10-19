/**
 * Förenklat repetitionsschema: +10 min, ikväll, imorgon bitti,
 * därefter 2, 3, 5 och 7 dagars intervall.
 * Komprimeras proportionellt om presentationsdatumet ligger närmare än schemat sträcker sig.
 * Used for visual milestones only — real review dates come from the scheduler.
 */
export function buildSchedule(start: Date, target?: Date): Date[] {
  const at = (days: number, hour: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  const steps: Date[] = [new Date(start.getTime() + 10 * 60 * 1000), at(0, 19), at(1, 8)];
  let days = 1;
  for (const gap of [2, 3, 5, 7]) {
    days += gap;
    steps.push(at(days, 18));
  }
  if (!target) return steps;
  const total = target.getTime() - start.getTime();
  const span = steps[steps.length - 1].getTime() - start.getTime();
  if (span <= total) return steps;
  const k = total / span;
  return steps.map((s) => new Date(start.getTime() + (s.getTime() - start.getTime()) * k));
}
