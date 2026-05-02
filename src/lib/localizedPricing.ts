// Locale-aware fallback prices for Premium subscriptions.
//
// On iOS the *actual* localized price comes from StoreKit via getNativePrices().
// These values are only used as a fallback shown briefly before the native side
// responds, or on the web. We pick a reasonable App Store equivalent based on
// the user's browser locale / region.

type PricePair = { monthly: string; yearly: string };

// Region-keyed table. Values are tuned to Apple's typical price tiers near
// 79 SEK / 299 SEK so the fallback reads naturally per market.
const PRICE_TABLE: Record<string, PricePair> = {
  SE: { monthly: "79 kr",        yearly: "299 kr" },
  NO: { monthly: "89 kr",        yearly: "329 kr" },
  DK: { monthly: "59 kr",        yearly: "219 kr" },
  GB: { monthly: "£6.99",        yearly: "£24.99" },
  US: { monthly: "$7.99",        yearly: "$29.99" },
  CA: { monthly: "CA$9.99",      yearly: "CA$39.99" },
  AU: { monthly: "A$11.99",      yearly: "A$44.99" },
  CH: { monthly: "CHF 7.50",     yearly: "CHF 29.00" },
  JP: { monthly: "¥1,200",       yearly: "¥4,500" },
  // Eurozone — covered explicitly so we don't fall back to USD
  DE: { monthly: "€7,99",        yearly: "€29,99" },
  FR: { monthly: "7,99 €",       yearly: "29,99 €" },
  ES: { monthly: "7,99 €",       yearly: "29,99 €" },
  IT: { monthly: "7,99 €",       yearly: "29,99 €" },
  PT: { monthly: "7,99 €",       yearly: "29,99 €" },
  NL: { monthly: "€ 7,99",       yearly: "€ 29,99" },
  BE: { monthly: "€ 7,99",       yearly: "€ 29,99" },
  IE: { monthly: "€7.99",        yearly: "€29.99" },
  AT: { monthly: "€ 7,99",       yearly: "€ 29,99" },
  FI: { monthly: "7,99 €",       yearly: "29,99 €" },
  GR: { monthly: "7,99 €",       yearly: "29,99 €" },
  LU: { monthly: "€ 7,99",       yearly: "€ 29,99" },
};

const EUR_DEFAULT: PricePair = { monthly: "€7.99", yearly: "€29.99" };
const USD_DEFAULT: PricePair = { monthly: "$7.99", yearly: "$29.99" };

const detectRegion = (): string | null => {
  if (typeof navigator === "undefined") return null;

  // Prefer full BCP-47 (e.g. "sv-SE") so we can read the region subtag.
  const candidates = [navigator.language, ...(navigator.languages ?? [])];

  for (const tag of candidates) {
    if (!tag) continue;
    const parts = tag.split("-");
    // Region subtag is typically 2 letters (e.g. "SE") or 3 digits.
    const region = parts.find((p) => /^[A-Za-z]{2}$/.test(p));
    if (region) return region.toUpperCase();
  }

  // Last resort: map known language-only tags to their dominant market.
  const lang = (navigator.language || "").toLowerCase().split("-")[0];
  const langToRegion: Record<string, string> = {
    sv: "SE", nb: "NO", nn: "NO", da: "DK", fi: "FI",
    de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT",
    nl: "NL", el: "GR", ja: "JP", en: "US",
  };
  return langToRegion[lang] ?? null;
};

/**
 * Get fallback Premium prices for the user's likely region.
 * Used until / unless the native iOS bridge supplies real App Store prices.
 */
export const getLocalizedFallbackPrices = (): PricePair => {
  const region = detectRegion();
  if (region && PRICE_TABLE[region]) return PRICE_TABLE[region];

  // Eurozone members not explicitly listed → euros
  const EUROZONE = new Set([
    "EE", "LV", "LT", "SK", "SI", "MT", "CY", "HR",
  ]);
  if (region && EUROZONE.has(region)) return EUR_DEFAULT;

  return USD_DEFAULT;
};
