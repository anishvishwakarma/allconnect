import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { AlertProvider } from "../context/AlertContext";
import { useAuthStore } from "../store/auth";

function RootStack() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    // Skip in Expo Go — push notifications removed in SDK 53; avoids "expo-notifications" console error
    if (Constants.appOwnership === "expo") return;

    function navigateFromNotification(data: Record<string, unknown> | undefined) {
      if (!token) return;
      const type = typeof data?.type === "string" ? data.type : "";
      const groupId = typeof data?.groupId === "string" ? data.groupId : "";
      const postId = typeof data?.postId === "string" ? data.postId : "";
      if (type === "chat_message" && groupId) {
        router.push(`/chat/${groupId}`);
      } else if (type === "join_approved" && postId) {
        router.push(`/post/${postId}`);
      }
    }

    let subscription: { remove: () => void } | null = null;
    import("expo-notifications").then((Notifications) => {
      const Notifs = Notifications.default ?? Notifications;
      Notifs.getLastNotificationResponseAsync?.()
        ?.then((response) => {
          const data = response?.notification.request.content.data as Record<string, unknown> | undefined;
          navigateFromNotification(data);
        })
        .catch(() => {});
      subscription = Notifs.addNotificationResponseReceivedListener?.((response) => {
        const data = response.notification.request.content.data as Record<string, unknown> | undefined;
        navigateFromNotification(data);
      }) ?? null;
    }).catch(() => {});

    return () => {
      subscription?.remove();
    };
  }, [hasHydrated, token]);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    // Push notifications not supported in Expo Go (SDK 53+)
    if (Constants.appOwnership === "expo") return;
    import("../services/pushNotifications")
      .then((m) => m.registerForPushNotifications())
      .catch(() => {});
  }, [hasHydrated, token]);
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
    <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
      <ThemeProvider>
        <AlertProvider>
          <RootStack />
        </AlertProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
