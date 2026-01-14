# App Store Build Guide for Sermable

This guide covers how to prepare and submit Sermable to the Apple App Store and Google Play Store.

## Prerequisites

- **Apple Developer Account** ($99/year) for iOS
- **Google Play Developer Account** ($25 one-time) for Android
- **Xcode** (Mac only) for iOS builds
- **Android Studio** for Android builds
- **Node.js** and npm installed locally

## Step 1: Export and Clone Project

1. Click **"Export to GitHub"** in Lovable to transfer the project
2. Clone the repository locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/sermable.git
   cd sermable
   ```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Build Web App

```bash
npm run build
```

This creates the `dist/` folder that Capacitor will use.

## Step 4: Add Native Platforms

```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android
```

## Step 5: Sync Native Projects

```bash
npx cap sync
```

Run this command every time you:
- Pull new changes from GitHub
- Run `npm run build`
- Change any Capacitor configuration

---

## iOS App Store Submission

### Configure in Xcode

1. Open the iOS project:
   ```bash
   npx cap open ios
   ```

2. **App Icons**:
   - Open `Assets.xcassets` → `AppIcon`
   - Add the icon from `src/assets/app-icon.png`
   - You'll need multiple sizes (Xcode will show required sizes)
   - Use a tool like [App Icon Generator](https://appicon.co/) to generate all sizes

3. **Splash Screen**:
   - Edit `App/App/LaunchScreen.storyboard`
   - Customize with Sermable branding (logo centered, dark background)

4. **Bundle ID & Signing**:
   - Select the project in navigator
   - Under "Signing & Capabilities":
     - Team: Select your Apple Developer team
     - Bundle Identifier: `app.lovable.9b84872939c64dff8ad785a9c71f1e67`
     - Enable "Automatically manage signing"

5. **Push Notifications** (Required):
   - Click "+ Capability"
   - Add "Push Notifications"
   - Add "Background Modes" → Enable "Remote notifications"

6. **Microphone Permission** (Required for speech features):
   - Open `Info.plist`
   - Add key: `NSMicrophoneUsageDescription`
   - Value: "Sermable needs microphone access to transcribe your speech practice"

7. **Speech Recognition Permission**:
   - Add key: `NSSpeechRecognitionUsageDescription`
   - Value: "Sermable uses speech recognition to analyze your practice sessions"

### Build for App Store

1. Select "Any iOS Device" as build target
2. Product → Archive
3. Window → Organizer → Distribute App
4. Follow App Store Connect upload process

### App Store Connect Metadata

**App Name**: Sermable

**Subtitle**: Master Your Speech with AI

**Description**:
```
Transform your public speaking with intelligent memorization technology.

Perfect for:
• Pastors memorizing sermons
• Executives preparing presentations
• Students learning speeches
• TEDx speakers mastering their talks

Features:
✓ AI-powered speech analysis and feedback
✓ Spaced repetition for long-term retention
✓ Beat-by-beat practice mode
✓ Real-time transcription and word tracking
✓ Multi-language support (7 languages)
✓ Progress tracking and streak system
✓ Dark mode support

Whether you're preparing for a keynote, sermon, or important presentation, Sermable helps you memorize and deliver your speech with confidence.
```

**Keywords**: speech memorization, public speaking, sermon practice, presentation trainer, speech coach, memorization app, speaker training, teleprompter, speech practice

**Category**: Education (Primary), Productivity (Secondary)

**Age Rating**: 4+

**Privacy URL**: https://your-domain.com/privacy

**Support URL**: https://your-domain.com/help

---

## Android Play Store Submission

### Configure in Android Studio

1. Open the Android project:
   ```bash
   npx cap open android
   ```

2. **App Icons**:
   - Right-click `res` folder → New → Image Asset
   - Select the icon from `src/assets/app-icon.png`
   - Generate adaptive icons for Android

3. **Splash Screen**:
   - Edit `res/drawable/splash.xml`
   - Customize colors and add logo

4. **Permissions** (already configured in `AndroidManifest.xml`):
   - Internet access
   - Microphone for speech recognition
   - Notifications for reminders

### Build for Play Store

1. Build → Generate Signed Bundle / APK
2. Choose "Android App Bundle"
3. Create or use existing keystore
4. Build release bundle

### Play Store Console Metadata

Use similar metadata as iOS, plus:
- Feature Graphic (1024 x 500 px)
- Screenshots (phone + tablet)
- Short description (80 chars max)

---

## Testing Before Submission

### iOS TestFlight

1. Upload build to App Store Connect
2. Add internal testers
3. Distribute via TestFlight

### Android Internal Testing

1. Upload AAB to Play Console
2. Create internal testing track
3. Add testers via email

---

## Checklist Before Submission

### Both Platforms
- [ ] App icon displays correctly
- [ ] Splash screen shows properly
- [ ] All features work on physical device
- [ ] Push notifications work
- [ ] Microphone permission requests appear
- [ ] Login/signup flows work
- [ ] Speech practice features work
- [ ] No console errors or crashes

### iOS Specific
- [ ] Works on iPhone and iPad
- [ ] Safe area insets respected
- [ ] Face ID works (if applicable)

### Android Specific
- [ ] Works on various screen sizes
- [ ] Back button behavior correct
- [ ] Notifications appear correctly

---

## Troubleshooting

### Build Errors
- Run `npx cap sync` after any changes
- Ensure `npm run build` succeeds first
- Check that all dependencies are installed

### Push Notifications Not Working
- Verify APNs certificates (iOS)
- Check Firebase configuration (Android)
- Ensure device tokens are being saved

### Hot Reload During Development
The `capacitor.config.ts` is configured for hot reload:
```typescript
server: {
  url: 'https://9b848729-39c6-4dff-8ad7-85a9c71f1e67.lovableproject.com?forceHideBadge=true',
  cleartext: true
}
```

**Important**: Remove or comment out the `server` config before building for production!

---

## Production Build Configuration

Before submitting to app stores, update `capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9b84872939c64dff8ad785a9c71f1e67',
  appName: 'Sermable',
  webDir: 'dist',
  // Remove or comment out server config for production
  // server: {
  //   url: '...',
  //   cleartext: true
  // },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
```

Then rebuild and sync:
```bash
npm run build
npx cap sync
```

---

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Play Store Policy Center](https://play.google.com/console/about/policy-center/)
- [Lovable Capacitor Blog Post](https://lovable.dev/blog/building-native-mobile-apps)
