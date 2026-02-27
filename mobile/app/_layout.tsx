import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { useAuthStore } from "../store/auth";
import { registerForPushNotifications } from "../services/pushNotifications";

function RootStack() {
  const token = useAuthStore((s) => s.token);
  useEffect(() => {
    if (token) registerForPushNotifications();
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
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
