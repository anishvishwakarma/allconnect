// Load .env so "eas build" and "expo config" see EXPO_PUBLIC_* when run locally; EAS cloud injects secrets
const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
} catch (_) {}

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
    // Use embedded bundle only — no OTA update fetch (avoids "Failed to download remote update" crash)
    updates: {
      enabled: false,
      checkAutomatically: "NEVER",
      fallbackToCacheTimeout: 0,
    },
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "58c0688a-478a-4e60-b4ec-cdb78d108e11",
      },
      firebase,
    },
    slug: "allconnect",
    version: "1.1.0",
    orientation: "portrait",
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
      buildNumber: "2",
      config: { googleMapsApiKey: mapsApiKeyIos },
      infoPlist: {
        NSPhotoLibraryUsageDescription: "AllConnect needs photo access to set your profile picture.",
        NSLocationWhenInUseUsageDescription: "AllConnect uses your location to show nearby events and add your post location on the map.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#E8751A",
      },
      package: "com.allconnect.app",
      versionCode: 2,
      config: {
        googleMaps: { apiKey: mapsApiKeyAndroid },
      },
    },
    plugins: [
      "expo-router",
      [
        "expo-location",
        { locationWhenInUsePermission: "AllConnect uses your location to show nearby events and add your post location on the map." },
      ],
      "expo-notifications",
      "@react-native-community/datetimepicker",
    ],
  },
};
