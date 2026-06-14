import { useEffect, useRef, useState } from 'react';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Cache the latest token until a logged-in session exists.
  const pendingTokenRef = useRef<{ token: string; platform: 'ios' | 'android' } | null>(null);

  const persistToken = async (token: string, platform: 'ios' | 'android') => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      // No user yet — queue and retry when auth state changes.
      pendingTokenRef.current = { token, platform };
      console.log('[push] token received before login — queued for later');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_platform: platform,
        notifications_enabled: true,
      })
      .eq('id', user.id);

    if (error) {
      console.error('[push] failed to save token:', error);
      toast({
        title: 'Could not save push token',
        description: error.message,
        variant: 'destructive',
      });
      // Keep it queued so the next auth event retries.
      pendingTokenRef.current = { token, platform };
    } else {
      pendingTokenRef.current = null;
      setIsRegistered(true);
      console.log('[push] token saved for user', user.id);
    }
  };

  const registerPushNotifications = async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        toast({
          title: 'Permission denied',
          description: 'Push notifications require permission to send you speech review reminders.',
          variant: 'destructive',
        });
        return;
      }

      await PushNotifications.register();
      setNotificationsEnabled(true);
      toast({
        title: 'Notifications enabled!',
        description: "You'll receive reminders when speeches are due for review.",
      });
    } catch (error) {
      console.error('Error registering push notifications:', error);
      toast({
        title: 'Registration failed',
        description: 'Could not enable push notifications. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    PushNotifications.checkPermissions().then((permStatus) => {
      setNotificationsEnabled(permStatus.receive === 'granted');
    });

    // If permission is already granted from a previous session, re-register so
    // we get the registration event again (Apple may issue a new token).
    PushNotifications.checkPermissions().then((s) => {
      if (s.receive === 'granted') {
        PushNotifications.register().catch((e) =>
          console.warn('[push] auto re-register failed', e),
        );
      }
    });

    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[push] registration success, token:', token.value);
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      await persistToken(token.value, platform);
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[push] registration error:', error);
      toast({
        title: 'Registration error',
        description:
          'Failed to register for push notifications. Check that Push Notifications capability is enabled in Xcode.',
        variant: 'destructive',
      });
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[push] notification received:', notification);
      toast({
        title: notification.title || 'New notification',
        description: notification.body || '',
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[push] notification action performed:', notification);
      window.location.href = '/dashboard';
    });

    // Retry queued token when user signs in.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && pendingTokenRef.current) {
        const { token, platform } = pendingTokenRef.current;
        persistToken(token, platform).catch((e) =>
          console.error('[push] retry persist failed', e),
        );
      }
    });

    return () => {
      PushNotifications.removeAllListeners();
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    isRegistered,
    notificationsEnabled,
    registerPushNotifications,
  };
};
