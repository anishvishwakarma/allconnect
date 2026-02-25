import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { chatsApi } from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";

const PRIMARY = "#E8751A";
const CAT_COLORS: Record<string, string> = {
  activity: "#30D158", need: "#0A84FF", selling: "#FFD60A",
  meetup: "#BF5AF2", event: "#FF453A", study: "#32ADE6",
  nightlife: "#E8751A", other: "#636366",
};

export default function ChatsScreen() {
  const token = useAuthStore((s) => s.token);
  const { isDark } = useAppTheme();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  async function load() {
    try { setGroups(await chatsApi.mine()); }
    catch { setGroups([]); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { if (token) load(); else setLoading(false); }, [token]);

  function timeRemaining(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h/24)}d left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  if (!token) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <Ionicons name="chatbubbles-outline" size={48} color={PRIMARY} />
        <Text style={[s.emptyTitle, { color: text }]}>Sign in for chats</Text>
        <Text style={[s.emptySub, { color: sub }]}>Group chats appear after your join request is approved</Text>
        <TouchableOpacity onPress={() => router.push("/login")} style={s.cta}>
          <Text style={s.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={[s.header, { borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>Chats</Text>
        <Text style={[s.subtitle, { color: sub }]}>Active group chats · auto-delete after event</Text>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={[s.center, { paddingTop: 60 }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={56} color={isDark ? "#2C2C2F" : "#E5E5EA"} />
              <Text style={[s.emptyTitle, { color: text }]}>No active chats</Text>
              <Text style={[s.emptySub, { color: sub }]}>Join a post and get approved to start chatting</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/map")} style={s.cta}>
                <Text style={s.ctaText}>Find Events</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const catColor = CAT_COLORS[item.category] || PRIMARY;
            const expiresAt = item.expires_at ?? item.expiresAt;
            const remaining = timeRemaining(expiresAt);
            const isExpiringSoon = new Date(expiresAt).getTime() - Date.now() < 3600000;
            return (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item.id}`)}
                style={[s.card, { backgroundColor: surface, borderColor: border }]}
                activeOpacity={0.75}
              >
                <View style={[s.avatar, { backgroundColor: catColor + "18" }]}>
                  <Ionicons name="people" size={22} color={catColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[s.chatName, { color: text }]} numberOfLines={1}>{item.title || item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <View style={[s.catChip, { backgroundColor: catColor + "18" }]}>
                      <Text style={[s.catChipText, { color: catColor }]}>{item.category}</Text>
                    </View>
                    <Text style={[s.meta, { color: sub }]}>
                      {(item.event_at ?? item.eventAt) ? new Date(item.event_at ?? item.eventAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Ionicons name="timer-outline" size={12} color={isExpiringSoon ? "#FF453A" : sub} />
                    <Text style={[s.meta, { color: isExpiringSoon ? "#FF453A" : sub, fontWeight: isExpiringSoon ? "600" : "400" }]}>
                      {remaining}
                    </Text>
                  </View>
                </View>
                <View style={[s.arrow, { backgroundColor: isDark ? "#2C2C2F" : "#F0F0F3" }]}>
                  <Ionicons name="chevron-forward" size={14} color={sub} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" },
  emptySub: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  cta: {
    marginTop: 20, backgroundColor: "#E8751A", paddingHorizontal: 28,
    paddingVertical: 14, borderRadius: 14,
    shadowColor: "#E8751A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: {
    flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  chatName: { fontSize: 15, fontWeight: "700" },
  catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catChipText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  meta: { fontSize: 12 },
  dot: { fontSize: 12 },
  arrow: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
