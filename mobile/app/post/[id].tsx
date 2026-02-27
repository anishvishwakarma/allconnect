import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { postsApi, requestsApi, chatsApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { CATEGORY_COLORS } from "../../constants/config";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";

export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isDark } = useAppTheme();
  const alert = useAlert();

  const [post, setPost] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [myRequest, setMyRequest] = useState<any>(null);
  const [groupChatId, setGroupChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const card = isDark ? "#252528" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  const isHost = (post?.host_id ?? post?.hostId) === user?.id;

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const p = await postsApi.get(id);
      setPost(p);
      if (token) {
        const hostId = p.host_id;
        if (hostId === user?.id) {
          setRequests(await requestsApi.forPost(id));
          const groups = await chatsApi.mine();
          const g = groups.find((gr: any) => gr.post_id === id);
          setGroupChatId(g?.id ?? null);
        } else {
          const myReq = await requestsApi.myRequest(id);
          setMyRequest(myReq ?? null);
          if (myReq?.status === "approved") {
            const groups = await chatsApi.mine();
            const g = groups.find((gr: any) => gr.post_id === id);
            setGroupChatId(g?.id ?? null);
          } else {
            setGroupChatId(null);
          }
        }
      }
    } catch (err: any) { alert.show("Something went wrong", "Could not load this post. Please try again.", undefined, "error"); }
    finally { setLoading(false); }
  }

  async function handleJoin() {
    setActionId("join");
    try {
      await requestsApi.send(id);
      const myReq = await requestsApi.myRequest(id);
      setMyRequest(myReq ?? null);
      alert.show("Request sent", "The host will review your request soon.", undefined, "success");
    } catch (err: any) { alert.show("Something went wrong", "Could not send your request. Please try again.", undefined, "error"); }
    finally { setActionId(null); }
  }

  async function handleAction(reqUserId: string, action: "approve" | "reject") {
    setActionId(reqUserId + action);
    try {
      if (action === "approve") await requestsApi.approve(id, reqUserId);
      else await requestsApi.reject(id, reqUserId);
      setRequests((prev) => prev.map((r) => (r.user_id === reqUserId ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r)));
      if (action === "approve") await load();
    } catch (err: any) { alert.show("Something went wrong", "Action failed. Please try again.", undefined, "error"); }
    finally { setActionId(null); }
  }

  if (loading) {
    return <View style={[s.center, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}><ActivityIndicator color={PRIMARY} size="large" /></View>;
  }
  if (!post) {
    return (
      <View style={[s.center, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Ionicons name="warning-outline" size={48} color={sub} />
        <Text style={[s.emptyTitle, { color: text }]}>Post not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backCta}>
          <Text style={[s.backCtaText, { color: PRIMARY }]}>← Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const catColor = CATEGORY_COLORS[post.category] || PRIMARY;
  const isActive = post.status === "open" || post.status === "active";
  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        {/* ── Top bar ── */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { backgroundColor: isDark ? "#1A1A1F" : "#F0F0F3" }]}>
            <Ionicons name="arrow-back" size={18} color={PRIMARY} />
          </TouchableOpacity>
          <View style={[s.statusPill, { backgroundColor: isActive ? "#30D15820" : "#63636320" }]}>
            <View style={[s.statusDot, { backgroundColor: isActive ? "#30D158" : "#636366" }]} />
            <Text style={[s.statusText, { color: isActive ? "#30D158" : "#636366" }]}>{post.status}</Text>
          </View>
        </View>

        {/* ── Hero card ── */}
        <View style={[s.heroCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={[s.catBanner, { backgroundColor: catColor + "18" }]}>
            <View style={[s.catDot2, { backgroundColor: catColor }]} />
            <Text style={[s.catText, { color: catColor }]}>{post.category}</Text>
          </View>
          <Text style={[s.postTitle, { color: text }]}>{post.title}</Text>
          {post.description && (
            <Text style={[s.desc, { color: sub }]}>{post.description}</Text>
          )}
        </View>

        {/* ── Info grid ── */}
        <View style={{ paddingHorizontal: 20, gap: 10, marginBottom: 20 }}>
          <InfoRow icon="calendar-outline" label="When" value={new Date(post.event_at || post.eventAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} catColor={catColor} surface={surface} text={text} sub={sub} border={border} />
          <InfoRow icon="hourglass-outline" label="Duration" value={`${post.duration_minutes ?? post.durationMinutes ?? 60} min`} catColor={catColor} surface={surface} text={text} sub={sub} border={border} />
          <InfoRow icon="people-outline" label="Spots" value={`Max ${post.max_people ?? post.maxParticipants ?? 0}`} catColor={catColor} surface={surface} text={text} sub={sub} border={border} />
          {(post.cost_per_person ?? post.costPerPerson) > 0 && <InfoRow icon="cash-outline" label="Cost" value={`₹${post.cost_per_person ?? post.costPerPerson} per person`} catColor={catColor} surface={surface} text={text} sub={sub} border={border} />}
          {(post.address_text || post.addressText) && <InfoRow icon="location-outline" label="Location" value={post.address_text || post.addressText} catColor={catColor} surface={surface} text={text} sub={sub} border={border} />}
          <InfoRow icon="shield-checkmark-outline" label="Approval" value="Host approval required" catColor={catColor} surface={surface} text={text} sub={sub} border={border} />
        </View>

        {/* ── Group chat button (when user is approved) ── */}
        {groupChatId && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <TouchableOpacity onPress={() => router.push(`/chat/${groupChatId}`)} style={[s.chatBtn, { backgroundColor: catColor }]}>
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={s.chatBtnText}>Open Group Chat</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Host: manage requests ── */}
        {isHost && (
          <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <View style={[s.sectionHeader]}>
              <View style={[s.sectionIcon, { backgroundColor: PRIMARY + "18" }]}>
                <Ionicons name="people-outline" size={16} color={PRIMARY} />
              </View>
              <Text style={[s.sectionTitle, { color: text }]}>
                Join Requests
                {pendingCount > 0 && (
                  <Text style={{ color: PRIMARY }}> · {pendingCount} pending</Text>
                )}
              </Text>
            </View>
            {requests.length === 0 && (
              <View style={[s.emptyCard, { backgroundColor: surface, borderColor: border }]}>
                <Text style={[s.emptySub, { color: sub }]}>No requests yet</Text>
              </View>
            )}
            {requests.map((req: any) => (
              <View key={req.id} style={[s.reqCard, { backgroundColor: surface, borderColor: border }]}>
                <View style={s.reqTop}>
                  <View style={[s.reqAvatar, { backgroundColor: PRIMARY + "18" }]}>
                    <Text style={[s.reqAvatarText, { color: PRIMARY }]}>
                      {(req.user_id || "?")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.reqName, { color: text }]}>User {req.user_id?.slice(0, 8)}</Text>
                    <Text style={[s.reqPhone, { color: sub }]}>Requested {new Date(req.created_at).toLocaleString()}</Text>
                  </View>
                  <StatusPill status={req.status} />
                </View>
                {req.status === "pending" && (
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleAction(req.user_id, "reject")}
                      disabled={!!actionId}
                      style={[s.rejectBtn, { borderColor: border, backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}
                    >
                      {actionId === req.user_id + "reject" ? <ActivityIndicator size="small" color={sub} />
                        : <Text style={[s.rejectText, { color: sub }]}>Decline</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleAction(req.user_id, "approve")}
                      disabled={!!actionId}
                      style={[s.approveBtn]}
                    >
                      {actionId === req.user_id + "approve" ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={s.approveBtnText}>Approve</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── Non-host: my request status ── */}
        {!isHost && token && isActive && (
          <View style={{ paddingHorizontal: 20 }}>
            {myRequest ? (
              <View style={[s.myReqCard, { backgroundColor: surface, borderColor: border }]}>
                <StatusPill status={myRequest.status} large />
                <Text style={[s.myReqText, { color: sub }]}>
                  {myRequest.status === "pending" && "Your request is waiting for host approval"}
                  {myRequest.status === "approved" && "You're in! Open the group chat above"}
                  {myRequest.status === "rejected" && "The host didn't accept your request this time"}
                </Text>
              </View>
            ) : (
              <TouchableOpacity onPress={handleJoin} disabled={actionId === "join"} style={s.joinBtn} activeOpacity={0.85}>
                {actionId === "join" ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.joinBtnText}>Request to Join</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {!token && (
          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity onPress={() => router.push("/login")} style={s.joinBtn} activeOpacity={0.85}>
              <Text style={s.joinBtnText}>Sign in to Join</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value, catColor, surface, text, sub, border }: any) {
  return (
    <View style={[s.infoRow, { backgroundColor: surface, borderColor: border }]}>
      <View style={[s.infoIcon, { backgroundColor: catColor + "18" }]}>
        <Ionicons name={icon} size={16} color={catColor} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={[s.infoLabel, { color: sub }]}>{label}</Text>
        <Text style={[s.infoValue, { color: text }]}>{value}</Text>
      </View>
    </View>
  );
}

function StatusPill({ status, large }: { status: string; large?: boolean }) {
  const cfg: Record<string, [string, string]> = {
    pending:  ["#FFD60A18", "#B8960A"],
    approved: ["#30D15818", "#30D158"],
    rejected: ["#FF453A18", "#FF453A"],
  };
  const [bg, color] = cfg[status] || cfg.pending;
  return (
    <View style={[s.pill, { backgroundColor: bg }, large && { paddingHorizontal: 14, paddingVertical: 8 }]}>
      <Text style={[s.pillText, { color }, large && { fontSize: 14 }]}>{status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: "center" },
  backCta: { marginTop: 16 },
  backCtaText: { fontSize: 15, fontWeight: "600" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  heroCard: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, padding: 20, borderWidth: StyleSheet.hairlineWidth, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  catBanner: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 12 },
  catDot2: { width: 7, height: 7, borderRadius: 3.5 },
  catText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  postTitle: { fontSize: 22, fontWeight: "800", lineHeight: 28, marginBottom: 8, letterSpacing: -0.3 },
  desc: { fontSize: 14, lineHeight: 22 },
  infoRow: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  infoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  infoValue: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  chatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16 },
  chatBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, flex: 1, marginLeft: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  emptyCard: { padding: 20, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  reqCard: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  reqTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  reqAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reqAvatarText: { fontSize: 18, fontWeight: "800" },
  reqName: { fontSize: 15, fontWeight: "700" },
  reqPhone: { fontSize: 12, marginTop: 2 },
  reqMsg: { marginTop: 10, padding: 10, borderRadius: 10 },
  rejectBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  rejectText: { fontWeight: "600", fontSize: 14 },
  approveBtn: { flex: 1.5, backgroundColor: "#E8751A", borderRadius: 12, paddingVertical: 12, alignItems: "center", shadowColor: "#E8751A", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  myReqCard: { borderRadius: 18, padding: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", gap: 12 },
  myReqText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  joinBtn: {
    backgroundColor: "#E8751A", borderRadius: 18, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    shadowColor: "#E8751A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  joinBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
});
