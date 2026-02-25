import { useEffect, useState } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { postsApi } from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";

const PRIMARY = "#E8751A";
const CAT_COLORS: Record<string, string> = {
  activity: "#30D158", need: "#0A84FF", selling: "#FFD60A",
  meetup: "#BF5AF2", event: "#FF453A", study: "#32ADE6",
  nightlife: "#E8751A", other: "#636366",
};

export default function HistoryScreen() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isDark } = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  async function load() {
    try { setItems(await postsApi.history()); }
    catch { setItems([]); }
    finally { setLoading(false); setRefreshing(false); }
  }

  useEffect(() => { if (token) load(); else setLoading(false); }, [token]);

  if (!token) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <Ionicons name="time-outline" size={48} color={PRIMARY} />
        <Text style={[s.emptyTitle, { color: text }]}>Sign in to see history</Text>
        <Text style={[s.emptySub, { color: sub }]}>Posts you created or joined will appear here</Text>
        <TouchableOpacity onPress={() => router.push("/login")} style={s.cta}>
          <Text style={s.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1 }, { backgroundColor: bg }]}>
      <View style={[s.header, { borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>History</Text>
        <Text style={[s.subtitle, { color: sub }]}>Your posts and joined events</Text>
      </View>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={PRIMARY} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id + (item.role || "")}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={PRIMARY} />}
          ListEmptyComponent={
            <View style={[s.center, { paddingTop: 60 }]}>
              <Ionicons name="calendar-outline" size={56} color={isDark ? "#2C2C2F" : "#E5E5EA"} />
              <Text style={[s.emptyTitle, { color: text }]}>No activity yet</Text>
              <Text style={[s.emptySub, { color: sub }]}>Create or join a post to get started</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/map")} style={s.cta}>
                <Text style={s.ctaText}>Explore Map</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const catColor = CAT_COLORS[item.category] || PRIMARY;
            const isCreated = item.role === "created" || item.host_id === user?.id;
            const expired = item.status === "closed" || item.status === "expired" || item.status === "cancelled";
            return (
              <TouchableOpacity
                onPress={() => router.push(`/post/${item.id}`)}
                style={[s.card, { backgroundColor: surface, borderColor: border }]}
                activeOpacity={0.75}
              >
                <View style={[s.accent, { backgroundColor: catColor }]} />
                <View style={{ flex: 1 }}>
                  <View style={s.cardTop}>
                    <Text style={[s.cardTitle, { color: text }]} numberOfLines={1}>{item.title}</Text>
                    <View style={[s.roleBadge, { backgroundColor: isCreated ? PRIMARY + "18" : "#0A84FF18" }]}>
                      <Text style={[s.roleText, { color: isCreated ? PRIMARY : "#0A84FF" }]}>
                        {isCreated ? "Host" : "Joined"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 }}>
                    <View style={[s.catChip, { backgroundColor: catColor + "18" }]}>
                      <Text style={[s.catChipText, { color: catColor }]}>{item.category}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Ionicons name="time-outline" size={12} color={sub} />
                      <Text style={[s.meta, { color: sub }]}>
                        {new Date(item.event_at || item.eventAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                  </View>
                  <View style={[s.statusRow]}>
                    <View style={[s.statusDot, { backgroundColor: expired ? "#636366" : "#30D158" }]} />
                    <Text style={[s.statusText, { color: expired ? "#636366" : "#30D158" }]}>{item.status}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={isDark ? "#3C3C3F" : "#C7C7CC"} />
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
    flexDirection: "row", alignItems: "center", borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  accent: { width: 4, alignSelf: "stretch" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", flex: 1, paddingVertical: 14, paddingLeft: 12 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginLeft: 12 },
  catChipText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  meta: { fontSize: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 12, paddingBottom: 12, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
});
