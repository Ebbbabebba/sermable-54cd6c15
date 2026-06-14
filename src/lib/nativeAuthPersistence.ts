// Persist Supabase auth across iOS/Android app launches.
//
// Why: in Capacitor WKWebView, localStorage can be evicted by iOS, and the
// origin differs between dev (lovableproject.com) and production builds
// (capacitor://localhost). That makes the user "logged out" between launches.
// We mirror the supabase auth token into native Preferences (iOS UserDefaults
// / Android SharedPreferences) and restore it before the app mounts, so the
// session survives evictions and origin changes.
//
// We can't edit the auto-generated supabase client, so we work around it by
// seeding localStorage from Preferences at startup and writing back on every
// auth change.

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

// Match the key supabase-js writes to localStorage. Format:
// `sb-<project-ref>-auth-token`
const PROJECT_REF = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  ?.match(/https?:\/\/([^.]+)\./)?.[1];
const AUTH_KEY = PROJECT_REF ? `sb-${PROJECT_REF}-auth-token` : null;

export async function bootstrapNativeAuth(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !AUTH_KEY) return;

  try {
    // 1. Restore from native storage into localStorage BEFORE supabase reads it.
    //    (supabase-js reads localStorage lazily on first call; this runs in main.tsx
    //    before any auth call, so the session is picked up automatically.)
    const { value } = await Preferences.get({ key: AUTH_KEY });
    if (value && !localStorage.getItem(AUTH_KEY)) {
      localStorage.setItem(AUTH_KEY, value);
    }

    // 2. Mirror any future change back into Preferences so it survives the
    //    next launch even if WKWebView clears localStorage.
    supabase.auth.onAuthStateChange((_event, session) => {
      try {
        if (session) {
          const raw = localStorage.getItem(AUTH_KEY);
          if (raw) Preferences.set({ key: AUTH_KEY, value: raw });
        } else {
          Preferences.remove({ key: AUTH_KEY });
        }
      } catch {
        /* ignore */
      }
    });
  } catch (err) {
    console.warn("[nativeAuth] bootstrap failed", err);
  }
}
