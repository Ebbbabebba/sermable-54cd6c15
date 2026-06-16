// Speech recognition warm-up helpers.
// Goal: take the slow, one-time costs (permission lookups, framework load,
// mic stream initialization) out of the critical path so that tapping the
// mic button starts listening almost instantly.

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as NativeSpeech } from "@capacitor-community/speech-recognition";

type WarmupState = {
  nativeAvailable: boolean | null;
  nativePermissionGranted: boolean | null;
  webMicGranted: boolean | null;
  webEnginePrimed: boolean;
};

const state: WarmupState = {
  nativeAvailable: null,
  nativePermissionGranted: null,
  webMicGranted: null,
  webEnginePrimed: false,
};

// Call on Practice page mount. Safe to call multiple times.
export async function warmupSpeechRecognition(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      if (state.nativeAvailable === null) {
        const { available } = await NativeSpeech.available();
        state.nativeAvailable = !!available;
      }
      if (state.nativeAvailable && state.nativePermissionGranted !== true) {
        const perm = await NativeSpeech.checkPermissions();
        if (perm.speechRecognition === "granted") {
          state.nativePermissionGranted = true;
        } else {
          const req = await NativeSpeech.requestPermissions();
          state.nativePermissionGranted = req.speechRecognition === "granted";
        }
      }
    } catch (e) {
      console.warn("Native speech warm-up failed:", e);
    }
    return;
  }

  // ---- Web Speech path ----
  try {
    // Check mic permission cheaply via the Permissions API when supported.
    if (state.webMicGranted === null && navigator.permissions?.query) {
      try {
        const status = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        state.webMicGranted = status.state === "granted";
        status.onchange = () => {
          state.webMicGranted = status.state === "granted";
        };
      } catch {
        // Some browsers (Safari) don't support 'microphone' here — leave null.
      }
    }

    // Prime the Web Speech engine once: instantiating + immediately aborting
    // a recognizer makes the browser load the underlying engine so the next
    // .start() call is near-instant.
    if (!state.webEnginePrimed) {
      const SR =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SR) {
        try {
          const r = new SR();
          r.continuous = false;
          r.interimResults = false;
          // Don't actually start — just constructing is enough on most engines
          // to load the model. .abort() is a no-op when not started.
          r.abort?.();
          state.webEnginePrimed = true;
        } catch {}
      }
    }
  } catch (e) {
    console.warn("Web speech warm-up failed:", e);
  }
}

export function isNativeAvailableCached(): boolean | null {
  return state.nativeAvailable;
}

export function isNativePermissionGrantedCached(): boolean | null {
  return state.nativePermissionGranted;
}

export function isWebMicGrantedCached(): boolean | null {
  return state.webMicGranted;
}

export function markNativePermissionGranted(): void {
  state.nativePermissionGranted = true;
}

export function markWebMicGranted(): void {
  state.webMicGranted = true;
}
