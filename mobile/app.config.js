const mapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Firebase config — set EXPO_PUBLIC_FIREBASE_* in .env (local) and EAS Secrets (production builds)
const firebase = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

module.exports = {
  expo: {
    name: "AllConnect",
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "58c0688a-478a-4e60-b4ec-cdb78d108e11",
      },
      firebase,
    },
    slug: "allconnect",
    version: "1.0.0",
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
      config: { googleMapsApiKey: mapsApiKey },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#E8751A",
      },
      package: "com.allconnect.app",
      config: {
        googleMaps: { apiKey: mapsApiKey },
      },
    },
    plugins: ["expo-router", "expo-location", "expo-notifications"],
  },
};
