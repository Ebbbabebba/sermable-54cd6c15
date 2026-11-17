/** Restore only unrecognized words; a retry never supplies speech evidence. */
export function restorePracticeSupport(
  hidden: ReadonlySet<number>, order: readonly number[], protectedWords: ReadonlySet<number>,
  targets: readonly number[], matched: ReadonlySet<number>,
) {
  const nextHidden = new Set(hidden);
  const nextProtected = new Set(protectedWords);
  for (const index of targets) {
    if (matched.has(index)) continue;
    nextHidden.delete(index);
    nextProtected.add(index);
  }
  // Ensure the animal overlay closes even if all targets happened to match.
  if (nextHidden.size === hidden.size && order.length) {
    const last = order[order.length - 1];
    nextHidden.delete(last);
    nextProtected.add(last);
  }
  return { hidden: nextHidden, order: order.filter(i => nextHidden.has(i)), protectedWords: nextProtected };
}