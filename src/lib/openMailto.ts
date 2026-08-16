/**
 * Opens a mailto: link reliably across web browsers and Capacitor WKWebView (iOS/Android).
 * Inside an iframe (Lovable preview) or WKWebView, `window.location.href = 'mailto:...'`
 * is often blocked silently, so we try several strategies and report success.
 *
 * Returns true if a mail client could plausibly be opened, false if everything failed
 * (caller should then fall back to showing/copying the address).
 */
export const buildMailtoUrl = (email: string, subject?: string, body?: string) => {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : "",
    body ? `body=${encodeURIComponent(body)}` : "",
  ]
    .filter(Boolean)
    .join("&");
  return `mailto:${email}${params ? `?${params}` : ""}`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

export const openMailto = (email: string, subject?: string, body?: string): boolean => {
  const url = buildMailtoUrl(email, subject, body);
  let opened = false;

  // 1) Try to escape an iframe (Lovable preview) by targeting the top window.
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      opened = true;
    }
  } catch {
    /* cross-origin iframe — continue */
  }

  // 2) Standard anchor click (works in browsers and most native shells).
  if (!opened) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.rel = "external noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      opened = true;
    } catch {
      /* continue */
    }
  }

  // 3) Native shells that need the _system target.
  if (!opened) {
    try {
      const w = window.open(url, "_system");
      opened = !!w;
    } catch {
      /* continue */
    }
  }

  // 4) Last resort: same-window navigation.
  if (!opened) {
    try {
      window.location.href = url;
      opened = true;
    } catch {
      opened = false;
    }
  }

  return opened;
};
