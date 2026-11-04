export const normalizeSupportWord = (word: string) =>
  word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

export function progressiveHideCount(visible: number, successes: number): number {
  if (visible <= 0) return 0;
  const step = Math.min(3, 1 + Math.max(0, successes));
  // Leave an intermediate supported round before the final no-script test.
  return Math.min(step, visible > 1 ? visible - 1 : 1);
}

export function nextSupportWord(
  words: string[], hidden: Set<number>, protectedWords: Set<number>,
  commonWords: Set<string>, easiestFirst: number[],
  eligible: (index: number) => boolean = () => true,
  aiSupport: Set<number> = new Set(),
): number | null {
  const candidates = easiestFirst.filter(i => eligible(i) && !hidden.has(i) &&
    normalizeSupportWord(words[i] ?? '') && !/^-(\d{1,2})?s?$/.test(words[i] ?? ''));
  const rank = (i: number) => {
    if (protectedWords.has(i)) return 5;
    if (aiSupport.has(i)) return 4;
    const raw = words[i] ?? '';
    if (/[.!?]["'”’)]*$/.test(raw)) return 3;
    if (commonWords.has(normalizeSupportWord(raw))) return 0;
    if (normalizeSupportWord(raw).length <= 4) return 1;
    return 2;
  };
  // Stable sort preserves observed easiest-first ordering within each tier.
  candidates.sort((a, b) => rank(a) - rank(b));
  return candidates[0] ?? null;
}