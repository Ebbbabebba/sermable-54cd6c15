// Lightweight, localStorage-backed practice preferences. Kept tiny on
// purpose — read synchronously at render time so we don't need a context.

const HESITATION_KEY = "sermable.practice.hesitationThresholdMs";

export const DEFAULT_HESITATION_MS = 2000;
export const MIN_HESITATION_MS = 1000;
export const MAX_HESITATION_MS = 5000;

export function getHesitationThresholdMs(): number {
  if (typeof window === "undefined") return DEFAULT_HESITATION_MS;
  try {
    const raw = window.localStorage.getItem(HESITATION_KEY);
    if (!raw) return DEFAULT_HESITATION_MS;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_HESITATION_MS;
    return Math.max(MIN_HESITATION_MS, Math.min(MAX_HESITATION_MS, n));
  } catch {
    return DEFAULT_HESITATION_MS;
  }
}

export function setHesitationThresholdMs(ms: number): void {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.max(MIN_HESITATION_MS, Math.min(MAX_HESITATION_MS, Math.round(ms)));
    window.localStorage.setItem(HESITATION_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent("sermable:practice-prefs-changed"));
  } catch {
    /* ignore */
  }
}
