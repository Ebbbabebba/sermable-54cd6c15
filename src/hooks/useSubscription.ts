import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getPaddleEnvironment } from "@/lib/paddle";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export const useSubscription = () => {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
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
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();

    // Listen for realtime changes to profile tier
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          if (payload.new?.subscription_tier) {
            setTier(payload.new.subscription_tier as SubscriptionTier);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
