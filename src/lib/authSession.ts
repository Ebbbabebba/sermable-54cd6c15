import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitForStableSession = async (timeoutMs = 2500): Promise<Session | null> => {
  const startedAt = Date.now();
  let lastSession: Session | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    const { data } = await supabase.auth.getSession();
    lastSession = data.session;

    if (lastSession) {
      return lastSession;
    }

    await delay(150);
  }

  return lastSession;
};