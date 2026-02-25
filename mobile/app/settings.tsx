import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useThemeStore } from "../store/theme";
import { useAuthStore } from "../store/auth";
import { disconnectSocket } from "../services/socket";
import { usersApi } from "../services/api";
import Constants from "expo-constants";

const PRIMARY = "#E8751A";
const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const [deleting, setDeleting] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  function openUrl(url: string, label: string) {
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Alert.alert("Link", `${label} will be available soon.`);
    }).catch(() => Alert.alert("Link", `${label} will be available soon.`));
  }

  function handleSignOut() {
    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => {
          disconnectSocket();
          logout();
          router.replace("/login");
        } },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account",
      "Your account and all your data (profile, posts, chats) will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm deletion",
              "Type DELETE to confirm permanent account deletion.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete my account",
                  style: "destructive",
                  onPress: confirmDeleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function confirmDeleteAccount() {
    if (!token) return;
    setDeleting(true);
    try {
      await usersApi.deleteAccount();
      disconnectSocket();
      logout();
      router.replace("/login");
      Alert.alert("Account deleted", "Your account and data have been permanently deleted.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not delete account. Try again or contact support.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.header, { paddingTop: insets.top + 12, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: text }]}>Settings</Text>
        <View style={s.backBtn} />
      </View>

      {/* Account — required for Play / App Store */}
      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>ACCOUNT</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <TouchableOpacity onPress={handleSignOut} style={s.row}>
            <Ionicons name="log-out-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Sign out</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deleting}
            style={[s.row, s.dangerRow]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FF453A" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#FF453A" />
            )}
            <Text style={[s.rowLabel, s.dangerText]}>Delete account</Text>
            <Ionicons name="chevron-forward" size={18} color="#FF453A" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>APPEARANCE</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          {(["system", "light", "dark"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              onPress={() => setTheme(mode)}
              style={[s.row, theme === mode && { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}
            >
              <Ionicons
                name={mode === "system" ? "phone-portrait-outline" : mode === "light" ? "sunny-outline" : "moon-outline"}
                size={20}
                color={sub}
              />
              <Text style={[s.rowLabel, { color: text }]}>
                {mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}
              </Text>
              {theme === mode && <Ionicons name="checkmark-circle" size={22} color={PRIMARY} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>NOTIFICATIONS</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={s.row}>
            <Ionicons name="notifications-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Push notifications</Text>
            <Text style={[s.hint, { color: sub }]}>Coming soon</Text>
          </View>
          <View style={[s.separator, { backgroundColor: border }]} />
          <View style={s.row}>
            <Ionicons name="chatbubble-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Chat alerts</Text>
            <Text style={[s.hint, { color: sub }]}>Coming soon</Text>
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>SUPPORT</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <TouchableOpacity
            onPress={() => openUrl("https://allconnect.app/help", "Help")}
            style={s.row}
          >
            <Ionicons name="help-circle-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Help & FAQ</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => openUrl("mailto:support@allconnect.app", "Contact")}
            style={s.row}
          >
            <Ionicons name="mail-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Contact us</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>LEGAL</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <TouchableOpacity
            onPress={() => openUrl("https://allconnect.app/privacy", "Privacy")}
            style={s.row}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Privacy policy</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => openUrl("https://allconnect.app/terms", "Terms")}
            style={s.row}
          >
            <Ionicons name="document-text-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Terms of use</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>ABOUT</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <View style={s.row}>
            <Ionicons name="information-circle-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>AllConnect</Text>
            <Text style={[s.hint, { color: sub }]}>v{APP_VERSION}</Text>
          </View>
          <View style={[s.separator, { backgroundColor: border }]} />
          <View style={s.row}>
            <Ionicons name="business-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Allpixel Technologies</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "700" },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  hint: { fontSize: 13 },
  dangerRow: {},
  dangerText: { color: "#FF453A", fontWeight: "600" },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
});
