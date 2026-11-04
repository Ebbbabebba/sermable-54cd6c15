export function hasMatchedAudienceTargets(targets: number[], matched: ReadonlySet<number>): boolean {
  return targets.length > 0 && targets.every(index => matched.has(index));
}

export function audienceHintOrder(targets: number[], errors: number[], keywords: ReadonlySet<number>): number[] {
  return [...targets].sort((a, b) => (errors[b] ?? 0) - (errors[a] ?? 0)
    || Number(keywords.has(b)) - Number(keywords.has(a)) || a - b);
}

export function visibleAudienceHints(order: number[], count: number, matched: ReadonlySet<number>): number[] {
  return order.slice(0, count).filter(index => !matched.has(index)).sort((a, b) => a - b);
}

export function audienceSilenceStep(idleMs: number, elapsedMs: number): number {
  return idleMs >= 2000 ? Math.max(0, elapsedMs) : 0;
}