import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { AlertProvider } from "../context/AlertContext";
import { useAuthStore } from "../store/auth";

function RootStack() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (!token) return;
    // Push notifications not supported in Expo Go (SDK 53+)
    if (Constants.appOwnership === "expo") return;
    import("../services/pushNotifications")
      .then((m) => m.registerForPushNotifications())
      .catch(() => {});
  }, [token]);
  const { isDark } = useAppTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade_from_bottom",
          contentStyle: { backgroundColor: isDark ? "#0C0C0F" : "#F5F5F7" },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AlertProvider>
          <RootStack />
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
