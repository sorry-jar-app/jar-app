import type { CapacitorConfig } from '@capacitor/cli';

/**
 * `npm run cap:sync` builds the static bundle into `out/` and copies it here.
 * Native platforms are not committed — run `npx cap add ios` / `npx cap add
 * android` once locally (needs Xcode / Android Studio) and they land in
 * gitignored `ios/` and `android/` folders.
 */
const config: CapacitorConfig = {
  appId: 'app.digijar.jar',
  appName: 'Digi Jar',
  webDir: 'out',
  backgroundColor: '#f7f1e8',
  ios: {
    contentInset: 'never',
    backgroundColor: '#f7f1e8',
  },
  android: {
    backgroundColor: '#f7f1e8',
  },
};

export default config;
