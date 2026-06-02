import { useEffect } from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAB_BAR_CONTENT_HEIGHT, TAB_ITEM_LIFT_UP } from "../../constants/config";
import { useAppInsets } from "../../hooks/useAppInsets";
import { useAuthStore } from "../../store/auth";
import { useBadgeStore } from "../../store/badges";
import { getSocket } from "../../services/socket";
import { useAppTheme } from "../../context/ThemeContext";

const PRIMARY = "#E8751A";

function tabBadge(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? "99+" : String(n);
}

/** Only the four side tabs — center + Post button keeps its own layout. */
const sideTabLift = {
  tabBarIconStyle: { marginTop: -TAB_ITEM_LIFT_UP },
  tabBarLabelStyle: { marginTop: -1, marginBottom: 2 },
};

export default function TabsLayout() {
  const { tabBarBottomPadding } = useAppInsets();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);
  const chatUnread = useBadgeStore((s) => s.chat_unread);
  const historyPending = useBadgeStore((s) => s.history_pending_requests);
  const { isDark } = useAppTheme();

  useEffect(() => {
    if (!token) {
      useBadgeStore.getState().reset();
      return;
    }
    void useBadgeStore.getState().refresh();
    const socket = getSocket();
    const bump = () => void useBadgeStore.getState().refresh();
    socket.on("new_message", bump);
    const interval = setInterval(() => void useBadgeStore.getState().refresh(), 45000);
    return () => {
      socket.off("new_message", bump);
      clearInterval(interval);
    };
  }, [token]);

  if (!hasHydrated) return null;
  const bg = isDark ? "#0C0C0F" : "#FFFFFF";
  const border = isDark ? "#1E1E21" : "#E5E5EA";
  const inactive = isDark ? "#505055" : "#AEAEB2";

  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + tabBarBottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: inactive,
        tabBarStyle: {
          backgroundColor: bg,
          borderTopColor: border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 10,
          elevation: 8,
          shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarBadgeStyle: {
          backgroundColor: PRIMARY,
          color: "#fff",
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "Explore",
          ...sideTabLift,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "map" : "map-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          ...sideTabLift,
          tabBarBadge: tabBadge(historyPending),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "time" : "time-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 48, height: 48, borderRadius: 24,
              backgroundColor: PRIMARY,
              alignItems: "center", justifyContent: "center",
              marginTop: -8,
              shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
            }}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          ...sideTabLift,
          tabBarBadge: tabBadge(chatUnread),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          ...sideTabLift,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
