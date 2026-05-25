import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export const useSubscription = () => {
  const [tier, setTier] = useState<SubscriptionTier>('free');
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
              if (payload.new?.subscription_tier) {
                setTier(payload.new.subscription_tier as SubscriptionTier);
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
