import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const usePushNotifications = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const registerPushNotifications = async () => {
    // Only works on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
      // Request permission
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

      // Register for push notifications
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

  const updatePushToken = async (token: string, platform: 'ios' | 'android') => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_platform: platform,
        notifications_enabled: true,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating push token:', error);
    } else {
      setIsRegistered(true);
      console.log('Push token registered successfully');
    }
  };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Check current permission status
    PushNotifications.checkPermissions().then((permStatus) => {
      setNotificationsEnabled(permStatus.receive === 'granted');
    });

    // Handle successful registration
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token:', token.value);
      
      const platform = Capacitor.getPlatform() as 'ios' | 'android';
      await updatePushToken(token.value, platform);
    });

    // Handle registration errors
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration:', error);
      toast({
        title: 'Registration error',
        description: 'Failed to register for push notifications.',
        variant: 'destructive',
      });
    });

    // Handle notification received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
      
      toast({
        title: notification.title || 'New notification',
        description: notification.body || '',
      });
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed:', notification);
      
      // Navigate to dashboard when notification is tapped
      window.location.href = '/dashboard';
    });

    // Clean up listeners on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);

  return {
    isRegistered,
    notificationsEnabled,
    registerPushNotifications,
  };
};
