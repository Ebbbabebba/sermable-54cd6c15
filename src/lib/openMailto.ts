/**
 * Opens a mailto: link reliably across web browsers and Capacitor WKWebView (iOS/Android).
 * In WKWebView, `window.location.href = 'mailto:...'` is often blocked silently.
 * An anchor click with rel="external" + window.open(_system) fallback works on iOS.
 */
export const openMailto = (email: string, subject?: string, body?: string) => {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : "",
    body ? `body=${encodeURIComponent(body)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const url = `mailto:${email}${params ? `?${params}` : ""}`;

  try {
    const a = document.createElement("a");
    a.href = url;
    a.rel = "external";
    a.target = "_top";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // ignore
  }

  // Fallback for native shells that need _system
  try {
    window.open(url, "_system");
  } catch {
    try {
      window.location.href = url;
    } catch {
      /* noop */
    }
  }
};
