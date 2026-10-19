/**
 * Browsers can report locale tags that the Intl API rejects outright
 * (for example "en-US@posix"), which would crash a whole screen while it
 * tries to format a date. Falling back to the base language keeps the
 * formatting localised where possible and never throws.
 */
export function safeLocale(locale?: string): string | undefined {
  if (!locale) return undefined;
  try {
    Intl.getCanonicalLocales(locale);
    return locale;
  } catch {
    const base = locale.split(/[-_@]/)[0];
    if (base) {
      try {
        Intl.getCanonicalLocales(base);
        return base;
      } catch {
        /* fall back to the browser default below */
      }
    }
    return undefined;
  }
}

export function dateFormatter(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(safeLocale(locale), options);
}
