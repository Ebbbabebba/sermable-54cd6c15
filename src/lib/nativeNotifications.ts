// Native iOS local-notification bridge.
// The iOS WKWebView wrapper registers a WKScriptMessageHandler named
// "scheduleNotification". In Safari / Android / desktop the bridge is absent
// and calls are a safe no-op.

export interface NativeNotificationInput {
  id: string;
  title: string;
  body: string;
  date: Date;
}

type NotificationBridge = {
  postMessage: (msg: { id: string; title: string; body: string; timestamp: number }) => void;
};

function getBridge(): NotificationBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    webkit?: { messageHandlers?: { scheduleNotification?: NotificationBridge } };
  };
  return w.webkit?.messageHandlers?.scheduleNotification ?? null;
}

export function hasNativeNotificationBridge(): boolean {
  return getBridge() !== null;
}

export function scheduleNativeNotification({ id, title, body, date }: NativeNotificationInput): void {
  try {
    const bridge = getBridge();
    if (!bridge) {
      console.log("[NativeNotifications] native notification bridge saknas – hoppar över", id);
      return;
    }
    const ms = date.getTime();
    if (!Number.isFinite(ms) || ms <= Date.now()) return;
    bridge.postMessage({ id, title, body, timestamp: Math.floor(ms / 1000) });
  } catch (err) {
    console.warn("[NativeNotifications] failed:", err);
  }
}
