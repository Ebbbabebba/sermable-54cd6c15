import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

const TIER_CACHE_KEY = 'sermable.subscription_tier';

const readCachedTier = (): SubscriptionTier => {
  try {
    const v = localStorage.getItem(TIER_CACHE_KEY);
    if (v === 'free' || v === 'student' || v === 'regular' || v === 'enterprise') {
      return v as SubscriptionTier;
    }
  } catch {}
  return 'free';
};

export const useSubscription = () => {
  // Seed from localStorage to avoid a brief "free" flash that locks premium users
  const [tier, setTier] = useState<SubscriptionTier>(() => readCachedTier());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const loadSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .single();

        if (profile?.subscription_tier) {
          setTier(profile.subscription_tier);
          try { localStorage.setItem(TIER_CACHE_KEY, profile.subscription_tier); } catch {}
        }

        if (cancelled) return;

        channel = supabase
          .channel(`subscription-changes-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${user.id}`,
            },
            (payload) => {
              const t = (payload.new as any)?.subscription_tier;
              if (t) {
                setTier(t as SubscriptionTier);
                try { localStorage.setItem(TIER_CACHE_KEY, t); } catch {}
              }
            }
          )
          .subscribe();
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const isPremium = tier !== 'free';
  const isStudent = tier === 'student';
  const isEnterprise = tier === 'enterprise';

  return {
    tier,
    isPremium,
    isStudent,
    isEnterprise,
    loading,
  };
};
