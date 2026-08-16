// Temporary override: payments are disabled, so every user gets full access.
// The UI must NOT advertise that the user is "Premium" — access is simply unlocked.
export const FORCE_PREMIUM = true;

export type Tier = 'free' | 'student' | 'regular' | 'enterprise';

/** Effective tier used for feature gating while payments are disabled. */
export const effectiveTier = (tier: Tier = 'free'): Tier =>
  FORCE_PREMIUM ? 'regular' : tier;
