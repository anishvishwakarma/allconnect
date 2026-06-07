import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { ThemeProvider, useAppTheme } from "../context/ThemeContext";
import { AlertProvider } from "../context/AlertContext";
import { useAuthStore } from "../store/auth";
import { useAppUpdateCheck } from "../hooks/useAppUpdateCheck";
import { isExpoGo } from "../constants/config";

function RootStack() {
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  useAppUpdateCheck();

  /** Portrait on phones without android:screenOrientation=PORTRAIT in manifest (Play Console policy). */
  useEffect(() => {
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isExpoGo()) return;

    function navigateFromNotification(data: Record<string, unknown> | undefined) {
      if (!token) return;
      const type = typeof data?.type === "string" ? data.type : "";
      const groupId = typeof data?.groupId === "string" ? data.groupId : "";
      const postId = typeof data?.postId === "string" ? data.postId : "";
      if (type === "chat_message" && groupId) {
        router.push(`/chat/${groupId}`);
      } else if (type === "join_approved") {
        if (groupId) router.push(`/chat/${groupId}`);
        else if (postId) router.push(`/post/${postId}`);
      } else if (type === "join_request" && postId) {
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
    if (isExpoGo()) return;
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
