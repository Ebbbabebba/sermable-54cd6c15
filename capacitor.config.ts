import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9b84872939c64dff8ad785a9c71f1e67',
  appName: 'Sermable',
  webDir: 'dist',
  // NOTE: No `server.url` here on purpose.
  // The iOS app loads the bundled `dist/` folder from capacitor://localhost,
  // which makes Capacitor.isNativePlatform() return true reliably.
  // The web URL (sermable.lovable.app) only ever shows the App Store wall.
  ios: {
    contentInset: 'always',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
