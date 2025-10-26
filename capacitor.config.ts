import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9b84872939c64dff8ad785a9c71f1e67',
  appName: 'Sermable',
  webDir: 'dist',
  server: {
    url: 'https://9b848729-39c6-4dff-8ad7-85a9c71f1e67.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
