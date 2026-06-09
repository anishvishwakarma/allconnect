// Load .env so "eas build" and "expo config" see EXPO_PUBLIC_* when run locally; EAS cloud injects secrets
const fs = require('fs');
const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (_) {}

const googleServicesFile = path.resolve(__dirname, 'google-services.json');
const hasGoogleServices = fs.existsSync(googleServicesFile);
/** EAS file env: upload google-services.json as GOOGLE_SERVICES_JSON (type file) for cloud builds. */
const easGoogleServices = process.env.GOOGLE_SERVICES_JSON?.trim();
const resolvedGoogleServicesFile =
  easGoogleServices && fs.existsSync(easGoogleServices)
    ? easGoogleServices
    : hasGoogleServices
      ? './google-services.json'
      : null;

// Single key (Expo Go + fallback), or use platform-specific keys for EAS builds
const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const mapsApiKeyAndroid = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || mapsApiKey;
const mapsApiKeyIos = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || mapsApiKey;

// Firebase config — set in .env (local) and EAS Secrets (production). No keys in repo.
const firebase = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

// Google Sign-In (OAuth client IDs from Google Cloud / Firebase). Optional until you set env vars.
const google = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "",
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
};

/** iOS reversed client id for Google Sign-In URL scheme (from EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID). */
function iosGoogleUrlSchemeFromClientId(iosClientId) {
  const id = String(iosClientId || "").trim();
  if (!id) return "";
  const suf = ".apps.googleusercontent.com";
  const i = id.indexOf(suf);
  if (i === -1) return "";
  return "com.googleusercontent.apps." + id.slice(0, i);
}

const googleIosUrlScheme = iosGoogleUrlSchemeFromClientId(google.iosClientId);
const googleSignInPluginOptions = googleIosUrlScheme.startsWith("com.googleusercontent.apps.")
  ? { iosUrlScheme: googleIosUrlScheme }
  : {};
const googleSignInPlugin = [["@react-native-google-signin/google-signin", googleSignInPluginOptions]];

const requiredEnv = [
  ["EXPO_PUBLIC_GOOGLE_MAPS_API_KEY", mapsApiKey],
  ["EXPO_PUBLIC_FIREBASE_API_KEY", firebase.apiKey],
  ["EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN", firebase.authDomain],
  ["EXPO_PUBLIC_FIREBASE_PROJECT_ID", firebase.projectId],
  ["EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET", firebase.storageBucket],
  ["EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID", firebase.messagingSenderId],
  ["EXPO_PUBLIC_FIREBASE_APP_ID", firebase.appId],
];

const missingEnv = requiredEnv
  .filter(([, value]) => !String(value || "").trim())
  .map(([name]) => name);

if (missingEnv.length > 0) {
  throw new Error(`Missing required Expo env vars: ${missingEnv.join(", ")}`);
}

module.exports = {
  expo: {
    name: "AllConnect",
    // Embedded JS only — never fetch EAS/OTA updates (fixes Android "Failed to download remote update")
    updates: {
      enabled: false,
      checkAutomatically: "NEVER",
      fallbackToCacheTimeout: 0,
      useEmbeddedUpdate: true,
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "58c0688a-478a-4e60-b4ec-cdb78d108e11",
      },
      firebase,
      google,
    },
    slug: "allconnect",
    owner: "allpixel-technologies-main",
    version: "1.1.6",
    /** Default on Android (Play large-screen policy); iOS portrait via infoPlist + runtime lock. */
    orientation: "default",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    scheme: "allconnect",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#E8751A",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.allconnect.app",
      buildNumber: "8",
      config: { googleMapsApiKey: mapsApiKeyIos },
      infoPlist: {
        NSPhotoLibraryUsageDescription: "AllConnect needs photo access to set your profile picture.",
        NSLocationWhenInUseUsageDescription: "AllConnect uses your location to show nearby events and add your post location on the map.",
        UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
        "UISupportedInterfaceOrientations~ipad": ["UIInterfaceOrientationPortrait"],
      },
    },
    android: {
      ...(resolvedGoogleServicesFile ? { googleServicesFile: resolvedGoogleServicesFile } : {}),
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#E8751A",
      },
      package: "com.allconnect.app",
      versionCode: 8,
      /** Lets the window shrink when the keyboard opens so ScrollView can reach password / buttons. */
      softwareKeyboardLayoutMode: "resize",
      config: {
        googleMaps: { apiKey: mapsApiKeyAndroid },
      },
    },
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            useDayNightTheme: true,
          },
        },
      ],
      "expo-screen-orientation",
      [
        "expo-updates",
        {
          enabled: false,
        },
      ],
      "expo-router",
      [
        "expo-location",
        { locationWhenInUsePermission: "AllConnect uses your location to show nearby events and add your post location on the map." },
      ],
      "expo-notifications",
      "@react-native-community/datetimepicker",
      ...googleSignInPlugin,
    ],
  },
};
