import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
