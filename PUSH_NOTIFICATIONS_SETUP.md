# Push Notifications Setup Guide

Your app now has native push notification support! Here's what has been implemented and what you need to do next.

## What's Already Set Up ✅

1. **Capacitor Configuration** - Your app is configured for iOS and Android
2. **Database Schema** - Push tokens are stored in the profiles table
3. **Edge Function** - `send-push-notifications` function ready to send notifications
4. **Client-Side Hook** - `usePushNotifications` handles registration and token management
5. **Settings Page** - Users can enable/disable notifications in Settings

## What You Need to Do 🚀

### Step 1: Export to GitHub and Clone Locally

1. Click "Export to Github" in Lovable
2. Clone your repository locally:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   npm install
   ```

### Step 2: Initialize Capacitor

Run the Capacitor initialization:
```bash
npx cap init
```

When prompted, use these values:
- **App ID**: `app.lovable.9b84872939c64dff8ad785a9c71f1e67`
- **App Name**: `Sermable`

### Step 3: Add Platforms

Add iOS and/or Android platforms:

```bash
# For iOS (requires macOS with Xcode)
npx cap add ios
npx cap update ios

# For Android (requires Android Studio)
npx cap add android
npx cap update android
```

### Step 4: Set Up Firebase Cloud Messaging (FCM)

#### A. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Add iOS and/or Android apps to your Firebase project

#### B. Get FCM Server Key
1. In Firebase Console, go to Project Settings > Cloud Messaging
2. Copy the **Server Key** (legacy)
3. Add this to your Lovable Cloud secrets as `FCM_SERVER_KEY`

#### C. Configure iOS (if using iOS)
1. Download `GoogleService-Info.plist` from Firebase
2. Add it to your Xcode project in the `ios/App/App` folder
3. In Xcode, enable Push Notifications capability
4. Upload APNs authentication key to Firebase (Project Settings > Cloud Messaging > APNs)

#### D. Configure Android (if using Android)
1. Download `google-services.json` from Firebase
2. Place it in `android/app/` folder
3. Add FCM plugin to your `android/app/build.gradle`:
   ```gradle
   dependencies {
       implementation 'com.google.firebase:firebase-messaging:23.0.0'
   }
   ```

### Step 5: Build and Run

```bash
# Build your web app
npm run build

# Sync changes to native platforms
npx cap sync

# Run on device/emulator
npx cap run ios    # For iOS
npx cap run android # For Android
```

### Step 6: Set Up Automated Notifications (Optional)

To send daily notifications automatically, set up a cron job:

1. Enable `pg_cron` extension in your Supabase project
2. Run this SQL in your database:

```sql
-- Schedule daily notification check at 9 AM
SELECT cron.schedule(
  'send-daily-review-notifications',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT net.http_post(
    url := 'https://ktlbseweighlrhoxbjii.supabase.co/functions/v1/send-push-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

Replace `YOUR_ANON_KEY` with your Supabase anon key.

## How It Works 🔄

1. **User enables notifications** in Settings
2. **App requests permission** from iOS/Android
3. **FCM token is generated** and stored in user's profile
4. **Cron job runs daily** checking for due reviews
5. **Notifications are sent** to users with speeches due for review
6. **User taps notification** and is taken to the dashboard

## Testing Notifications 🧪

### Manual Test
You can manually trigger notifications by calling the edge function:

```bash
curl -X POST \
  https://ktlbseweighlrhoxbjii.supabase.co/functions/v1/send-push-notifications \
  -H "Content-Type: application/json"
```

### Test on Device
1. Install app on physical device (simulator won't receive real push notifications)
2. Enable notifications in Settings
3. Create a speech and set it due for review
4. Manually call the edge function to test

## Troubleshooting 🔧

### Notifications not received?
- Check that FCM_SERVER_KEY is set correctly in Lovable Cloud secrets
- Verify push_token is saved in profiles table
- Check edge function logs in Lovable Cloud dashboard
- Ensure device has internet connection and app is registered for push

### iOS specific issues?
- Verify APNs certificate is uploaded to Firebase
- Check that Push Notifications capability is enabled in Xcode
- Test on physical device (not simulator)

### Android specific issues?
- Verify `google-services.json` is in correct location
- Check that FCM dependencies are in build.gradle
- Ensure app has notification permissions

## Next Steps 🎯

1. Test notifications on a physical device
2. Customize notification timing and frequency
3. Add rich notifications with images and actions
4. Implement notification preferences (time of day, frequency)
5. Add analytics to track notification engagement

## Need Help?

- [Capacitor Push Notifications Documentation](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Lovable Cloud Documentation](https://docs.lovable.dev)
