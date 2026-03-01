import { useEffect, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  ScrollView, StyleSheet, Image,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usersApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { disconnectSocket } from "../../services/socket";
import { getInitials } from "../../utils/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../../constants/config";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, updateUser, logout } = useAuthStore();
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  useEffect(() => {
    if (!token) return;
    usersApi.me().then((u) => { updateUser(u); setName(u.name || ""); setEmail(u.email || ""); }).catch(() => {});
  }, [token]);

  if (!token) {
    return (
      <View style={[s.center, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: getBottomInset(insets.bottom) }]}>
        <View style={[s.bigAvatar, { backgroundColor: PRIMARY + "18" }]}>
          <Ionicons name="person-circle-outline" size={48} color={PRIMARY} />
        </View>
        <Text style={[s.emptyTitle, { color: text }]}>Your profile</Text>
        <Text style={[s.emptySub, { color: sub }]}>Sign in to view and edit your profile</Text>
        <TouchableOpacity onPress={() => router.replace("/login")} style={s.cta}>
          <Text style={s.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function save() {
    setSaving(true);
    try {
      const u = await usersApi.update({ name: name.trim() || undefined, email: email.trim() || undefined });
      updateUser(u); setEditing(false); alert.show("Saved", "Profile updated.", undefined, "success");
    } catch (err: any) { alert.show("Something went wrong", "Could not save. Please try again.", undefined, "error"); }
    finally { setSaving(false); }
  }

  function confirmLogout() {
    alert.show("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => { disconnectSocket(); logout(); router.replace("/login"); } },
    ], "info");
  }

  const subEnd = user?.subscription_ends_at;
  const postsMonth = user?.posts_this_month ?? 0;
  const hasSubscription = subEnd && new Date(subEnd) > new Date();
  const freeRemaining = Math.max(0, 5 - postsMonth);
  const initial = getInitials(user?.name);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={{ paddingBottom: getBottomInset(insets.bottom) + 48 }} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border, paddingTop: insets.top + 16 }]}>
        <Text style={[s.title, { color: text }]}>Profile</Text>
        {!editing ? (
          <TouchableOpacity onPress={() => setEditing(true)} style={[s.editBtn, { backgroundColor: PRIMARY + "18", borderColor: PRIMARY + "40" }]}>
            <Ionicons name="pencil-outline" size={14} color={PRIMARY} />
            <Text style={[s.editBtnText, { color: PRIMARY }]}>Edit</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity onPress={() => setEditing(false)} style={[s.editBtn, { backgroundColor: isDark ? "#252528" : "#F0F0F3", borderColor: border }]}>
              <Text style={[s.editBtnText, { color: sub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} style={[s.editBtn, { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.editBtnText, { color: "#fff" }]}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Avatar section */}
      <View style={s.avatarSection}>
        <View style={[s.avatarRing, { borderColor: PRIMARY }]}>
          {user?.avatar_uri ? (
            <Image source={{ uri: user.avatar_uri }} style={s.avatarImage} />
          ) : (
            <View style={[s.avatar, { backgroundColor: PRIMARY + "18" }]}>
              <Text style={[s.avatarText, { color: PRIMARY }]}>{initial}</Text>
            </View>
          )}
        </View>
        <Text style={[s.phoneText, { color: sub }]}>{user?.email || (user?.mobile?.startsWith?.("email:") ? user.mobile.replace("email:", "") : user?.mobile)}</Text>
        <View style={[s.privacyBadge, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}>
          <Ionicons name="eye-off-outline" size={12} color={sub} />
          <Text style={[s.privacyText, { color: sub }]}>Identity hidden until approved</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {/* Name + Bio */}
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: PRIMARY + "18" }]}>
              <Ionicons name="person-outline" size={16} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: sub }]}>Display name</Text>
              {editing ? (
                <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={sub} maxLength={60}
                  style={[s.fieldInput, { color: text, borderBottomColor: PRIMARY }]} />
              ) : (
                <Text style={[s.fieldValue, { color: name ? text : sub }]}>{name || "Not set"}</Text>
              )}
            </View>
          </View>
          <View style={[s.separator, { backgroundColor: border }]} />
          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}>
              <Ionicons name="mail-outline" size={16} color={sub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: sub }]}>Email</Text>
              {editing ? (
                <TextInput value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor={sub}
                  keyboardType="email-address" autoCapitalize="none"
                  style={[s.fieldInput, { color: text, borderBottomColor: PRIMARY }]} />
              ) : (
                <Text style={[s.fieldValue, { color: email ? text : sub }]}>{email || "Not set"}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Edit profile & Settings */}
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <TouchableOpacity
            onPress={() => router.push("/profile/edit")}
            style={s.menuRow}
          >
            <View style={[s.fieldIcon, { backgroundColor: PRIMARY + "18" }]}>
              <Ionicons name="person-outline" size={18} color={PRIMARY} />
            </View>
            <Text style={[s.menuLabel, { color: text }]}>Edit profile</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={s.menuRow}
          >
            <View style={[s.fieldIcon, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}>
              <Ionicons name="settings-outline" size={18} color={sub} />
            </View>
            <Text style={[s.menuLabel, { color: text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
        </View>

        {/* Plan card */}
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={s.fieldRow}>
            <View style={[s.fieldIcon, { backgroundColor: hasSubscription ? "#30D15818" : PRIMARY + "18" }]}>
              <Ionicons name="star-outline" size={16} color={hasSubscription ? "#30D158" : PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: sub }]}>Plan</Text>
              {hasSubscription ? (
                <>
                  <Text style={[s.fieldValue, { color: "#30D158" }]}>Pro · Unlimited posts</Text>
                  <Text style={[s.fieldSub, { color: sub }]}>Renews {new Date(subEnd!).toLocaleDateString()}</Text>
                </>
              ) : (
                <>
                  <Text style={[s.fieldValue, { color: text }]}>Free · {freeRemaining}/{5} posts left</Text>
                  <Text style={[s.fieldSub, { color: sub }]}>Resets 1st of every month</Text>
                </>
              )}
            </View>
          </View>
          {!hasSubscription && (
            <>
              <View style={[s.separator, { backgroundColor: border }]} />
              <TouchableOpacity
                onPress={() => alert.show("Coming soon", "Pro upgrade will be available soon. You can still create up to 5 free posts per month.", undefined, "info")}
                style={[s.upgradeBtn, { backgroundColor: PRIMARY + "12" }]}
              >
                <Ionicons name="rocket-outline" size={16} color={PRIMARY} />
                <Text style={[s.upgradeBtnText, { color: PRIMARY }]}>Upgrade to Pro — Unlimited posts</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Sign out */}
        <TouchableOpacity onPress={confirmLogout} style={[s.logoutBtn, { backgroundColor: "#FF453A12", borderColor: "#FF453A30" }]}>
          <Ionicons name="log-out-outline" size={18} color="#FF453A" />
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  cta: { marginTop: 8, backgroundColor: "#E8751A", paddingHorizontal: 32, paddingVertical: 15, borderRadius: 14, shadowColor: "#E8751A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  editBtnText: { fontSize: 13, fontWeight: "600" },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 8 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, padding: 4, overflow: "hidden" },
  avatar: { width: "100%", height: "100%", borderRadius: 42, alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 42 },
  avatarText: { fontSize: 36, fontWeight: "800" },
  phoneText: { fontSize: 14, fontWeight: "500" },
  privacyBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  privacyText: { fontSize: 11, fontWeight: "500" },
  card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 },
  fieldRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, padding: 16 },
  fieldIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 2 },
  fieldLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  fieldValue: { fontSize: 15, fontWeight: "500" },
  fieldSub: { fontSize: 12, marginTop: 2 },
  fieldInput: { fontSize: 15, borderBottomWidth: 1.5, paddingBottom: 6, paddingTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 66 },
  upgradeBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 16 },
  upgradeBtnText: { fontSize: 14, fontWeight: "700" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 18, borderWidth: 1 },
  logoutText: { color: "#FF453A", fontWeight: "700", fontSize: 15 },
});
