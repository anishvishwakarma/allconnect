module.exports = {
  expo: {
    name: "AllConnect",
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined,
      },
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
      config: { googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "placeholder" },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#E8751A",
      },
      package: "com.allconnect.app",
      config: {
        googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "placeholder" },
      },
    },
    plugins: ["expo-router", "expo-location", "expo-notifications"],
  },
};
