import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../../constants/config";
import { useAuthStore } from "../../store/auth";
import { useBadgeStore } from "../../store/badges";
import { notificationsApi } from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";

const PRIMARY = "#E8751A";

function notificationKind(data: Record<string, unknown>): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  const t = typeof data.type === "string" ? data.type : "";
  if (t === "join_request") return { label: "Join request", icon: "person-add-outline" };
  if (t === "join_approved") return { label: "Approved to join", icon: "checkmark-circle-outline" };
  if (t === "chat_message") return { label: "Group chat", icon: "chatbubbles-outline" };
  return { label: "Update", icon: "notifications-outline" };
}

function contextLine(data: Record<string, unknown>): string | null {
  const postTitle = typeof data.postTitle === "string" ? data.postTitle.trim() : "";
  const chatTitle = typeof data.chatTitle === "string" ? data.chatTitle.trim() : "";
  const requester = typeof data.requesterName === "string" ? data.requesterName.trim() : "";
  const sender = typeof data.senderName === "string" ? data.senderName.trim() : "";
  const t = typeof data.type === "string" ? data.type : "";
  if (t === "join_request" && postTitle) return postTitle;
  if (t === "join_request" && requester) return `From ${requester}`;
  if (t === "join_approved" && postTitle) return postTitle;
  if (t === "chat_message" && chatTitle && sender) return `${chatTitle} · ${sender}`;
  if (t === "chat_message" && chatTitle) return chatTitle;
  if (t === "chat_message" && sender) return sender;
  return null;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const { isDark } = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list(60);
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      void useBadgeStore.getState().refresh();
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    load();
  }, [token, load]);

  async function markOneAndOpen(item: any) {
    try {
      if (!item.read_at) {
        const updated = await notificationsApi.markRead(item.id);
        setItems((prev) => prev.map((n) => (n.id === item.id ? updated : n)));
      }
    } catch {}
    const data = (item.data || {}) as Record<string, unknown>;
    const type = typeof data.type === "string" ? data.type : "";
    const groupId = typeof data.groupId === "string" ? data.groupId : "";
    const postId = typeof data.postId === "string" ? data.postId : "";
    if (type === "chat_message" && groupId) router.push(`/chat/${groupId}`);
    else if (type === "join_approved") {
      if (groupId) router.push(`/chat/${groupId}`);
      else if (postId) router.push(`/post/${postId}`);
    } else if (type === "join_request" && postId) router.push(`/post/${postId}`);
    void useBadgeStore.getState().refresh();
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
      void useBadgeStore.getState().refresh();
    } catch {
    } finally {
      setMarkingAll(false);
    }
  }

  if (!token) {
    return (
      <View style={[s.center, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: getBottomInset(insets.bottom) }]}>
        <Ionicons name="notifications-outline" size={46} color={PRIMARY} />
        <Text style={[s.emptyTitle, { color: text }]}>Sign in for notifications</Text>
        <Text style={[s.emptySub, { color: sub }]}>You will see message and request updates here</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={[s.header, { borderBottomColor: border, paddingTop: insets.top + 16 }]}>
        <Text style={[s.title, { color: text }]}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead} disabled={markingAll || items.every((i) => !!i.read_at)}>
          <Text style={[s.markAll, { color: markingAll ? sub : PRIMARY }]}>
            {markingAll ? "Marking..." : "Mark all read"}
          </Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: getBottomInset(insets.bottom) + 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={[s.center, { paddingTop: 80 }]}>
              <Ionicons name="notifications-off-outline" size={56} color={isDark ? "#2C2C2F" : "#E5E5EA"} />
              <Text style={[s.emptyTitle, { color: text }]}>No notifications yet</Text>
              <Text style={[s.emptySub, { color: sub }]}>New messages and join updates will appear here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isUnread = !item.read_at;
            const data = (item.data || {}) as Record<string, unknown>;
            const kind = notificationKind(data);
            const ctx = contextLine(data);
            return (
              <TouchableOpacity
                onPress={() => markOneAndOpen(item)}
                style={[s.card, { backgroundColor: surface, borderColor: isUnread ? PRIMARY + "66" : border }]}
                activeOpacity={0.8}
              >
                <View style={[s.iconWrap, { backgroundColor: isUnread ? PRIMARY + "18" : (isDark ? "#2C2C2F" : "#F0F0F3") }]}>
                  <Ionicons name={kind.icon} size={16} color={isUnread ? PRIMARY : sub} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <View style={[s.kindPill, { backgroundColor: isDark ? "#2C2C2F" : "#F0F0F3" }]}>
                      <Text style={[s.kindPillText, { color: isUnread ? PRIMARY : sub }]}>{kind.label}</Text>
                    </View>
                  </View>
                  <Text style={[s.cardTitle, { color: text, marginTop: 6 }]} numberOfLines={2}>{item.title}</Text>
                  {ctx ? <Text style={[s.cardContext, { color: sub }]} numberOfLines={1}>{ctx}</Text> : null}
                  <Text style={[s.cardBody, { color: sub }]} numberOfLines={2}>{item.body}</Text>
                  <Text style={[s.cardTime, { color: sub }]}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
                {isUnread ? <View style={s.unreadDot} /> : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  markAll: { fontSize: 13, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 14, textAlign: "center" },
  emptySub: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  iconWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  kindPill: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  kindPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardContext: { fontSize: 12, marginTop: 4, fontWeight: "600", opacity: 0.9 },
  cardBody: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  cardTime: { fontSize: 11, marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 6, marginLeft: 8 },
});
