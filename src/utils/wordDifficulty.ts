/**
 * Per-word difficulty memory (local, per beat).
 *
 * Every finished repetition records which word indices the user hesitated on
 * or missed. Recall sessions then pre-hide the words the user has had the
 * FEWEST errors on — the easiest words disappear first, the shaky ones stay
 * visible until they are earned.
 */

type BeatWordStats = {
  wordCount: number;
  reps: number;
  errors: Record<number, number>;
};

const KEY = (beatId: string) => `sermable:wordDifficulty:${beatId}`;

function read(beatId: string, wordCount: number): BeatWordStats {
  try {
    const raw = localStorage.getItem(KEY(beatId));
    if (raw) {
      const parsed = JSON.parse(raw) as BeatWordStats;
      // Text was edited → old indices are meaningless.
      if (parsed && parsed.wordCount === wordCount && parsed.errors) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { wordCount, reps: 0, errors: {} };
}

export function recordRepDifficulty(
  beatId: string | undefined | null,
  wordCount: number,
  failedIndices: Iterable<number>
): void {
  if (!beatId || wordCount <= 0) return;
  try {
    const stats = read(beatId, wordCount);
    stats.reps += 1;
    for (const idx of failedIndices) {
      if (idx >= 0 && idx < wordCount) {
        stats.errors[idx] = (stats.errors[idx] ?? 0) + 1;
      }
    }
    localStorage.setItem(KEY(beatId), JSON.stringify(stats));
  } catch {
    /* storage unavailable — difficulty memory is best-effort */
  }
}

/**
 * Indices ordered easiest → hardest (fewest recorded errors first).
 * Ties keep natural text order so the result is stable between sessions.
 */
export function getEasiestWordIndices(
  beatId: string | undefined | null,
  wordCount: number,
  eligible: (index: number) => boolean = () => true
): number[] {
  const stats = beatId ? read(beatId, wordCount) : { wordCount, reps: 0, errors: {} as Record<number, number> };
  const candidates: number[] = [];
  for (let i = 0; i < wordCount; i++) if (eligible(i)) candidates.push(i);
  return candidates.sort((a, b) => {
    const ea = stats.errors[a] ?? 0;
    const eb = stats.errors[b] ?? 0;
    if (ea !== eb) return ea - eb;
    return a - b;
  });
}

export function hasDifficultyHistory(beatId: string | undefined | null, wordCount: number): boolean {
  if (!beatId) return false;
  return read(beatId, wordCount).reps > 0;
}
