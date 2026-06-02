import { CapacitorConfig } from '@capacitor/cli';

// Hot-reload server is ONLY used in development.
// For App Store / production builds, set CAP_ENV=production (or just NODE_ENV=production)
// before running `npx cap sync` so the app loads the bundled `dist/` instead of the sandbox URL.
const isProduction =
  process.env.CAP_ENV === 'production' || process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'app.lovable.9b84872939c64dff8ad785a9c71f1e67',
  appName: 'Sermable',
  webDir: 'dist',
  ...(isProduction
    ? {}
    : {
        server: {
          url: 'https://9b848729-39c6-4dff-8ad7-85a9c71f1e67.lovableproject.com?forceHideBadge=true',
          cleartext: true,
        },
      }),
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
