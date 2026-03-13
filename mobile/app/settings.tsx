import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";
import { useAppTheme } from "../context/ThemeContext";
import { useThemeStore } from "../store/theme";
import { useAuthStore } from "../store/auth";
import { disconnectSocket } from "../services/socket";
import { usersApi } from "../services/api";
import Constants from "expo-constants";
import { useAlert } from "../context/AlertContext";
import { getCurrentFirebaseIdToken } from "../services/firebaseAuth";

const PRIMARY = "#E8751A";
const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [deleting, setDeleting] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [reAuthLoading, setReAuthLoading] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  function openUrl(url: string, label: string) {
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else alert.show("Link", `${label} will be available soon.`, undefined, "info");
    }).catch(() => alert.show("Link", `${label} will be available soon.`, undefined, "info"));
  }

  function handleSignOut() {
    alert.show(
      "Sign out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => {
          disconnectSocket();
          logout();
          router.replace("/login");
        } },
      ],
      "info"
    );
  }

  function handleDeleteAccount() {
    alert.show(
      "Delete account",
      "Your account and all your data (profile, posts, chats) will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeletePassword("");
            setPasswordError(null);
            setShowPasswordPrompt(true);
          },
        },
      ],
      "error"
    );
  }

  async function confirmDeleteAccount() {
    if (!token) return;
    setDeleting(true);
    try {
      const firebaseIdToken = await getCurrentFirebaseIdToken();
      if (!firebaseIdToken) {
        alert.show("Sign in again", "Please sign in again before deleting your account.", undefined, "info");
        return;
      }
      await usersApi.deleteAccount(firebaseIdToken);
      disconnectSocket();
      logout();
      router.replace("/login");
      alert.show("Account deleted", "Your account and data have been permanently deleted.", undefined, "success");
    } catch (err: any) {
      const message = err?.message || "";
      if (message.includes("Re-authentication required")) {
        alert.show("Sign in again", "For security, please sign in again and then retry account deletion.", undefined, "info");
      } else {
        alert.show("Something went wrong", "Could not delete account. Try again or contact support.", undefined, "error");
      }
    } finally {
      setDeleting(false);
    }
  }

  // Extra bottom padding only here (and any other screen with nav bar overlap); global fallback stays 32 so other screens are unchanged
  const bottomPadding = getBottomInset(insets.bottom) + 48;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: bottomPadding }}
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
            <Text style={[s.hint, { color: sub }]}>Enabled on supported builds</Text>
          </View>
          <View style={[s.separator, { backgroundColor: border }]} />
          <View style={s.row}>
            <Ionicons name="chatbubble-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Chat alerts</Text>
            <Text style={[s.hint, { color: sub }]}>On when permission is granted</Text>
          </View>
        </View>
      </View>

      <View style={s.section}>
        <Text style={[s.sectionTitle, { color: sub }]}>SUPPORT</Text>
        <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
          <TouchableOpacity
            onPress={() => router.push("/help")}
            style={s.row}
          >
            <Ionicons name="help-circle-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Help & FAQ</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => openUrl("mailto:contact@allpixel.in", "Contact")}
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
            onPress={() => router.push("/privacy")}
            style={s.row}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Privacy policy</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => openUrl("https://allpixel.in/delete-account.html", "Account deletion")}
            style={s.row}
          >
            <Ionicons name="person-remove-outline" size={20} color={sub} />
            <Text style={[s.rowLabel, { color: text }]}>Account deletion (website)</Text>
            <Ionicons name="chevron-forward" size={18} color={sub} />
          </TouchableOpacity>
          <View style={[s.separator, { backgroundColor: border }]} />
          <TouchableOpacity
            onPress={() => router.push("/terms")}
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
      {showPasswordPrompt && (
        <View style={s.overlay}>
          <View style={[s.passwordCard, { backgroundColor: surface, borderColor: border }]}>
            <Text style={[s.passwordTitle, { color: text }]}>Confirm with password</Text>
            <Text style={[s.passwordSub, { color: sub }]}>
              For security, enter your password to permanently delete your account.
            </Text>
            <TextInput
              value={deletePassword}
              onChangeText={(v) => {
                setDeletePassword(v);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Password"
              placeholderTextColor={sub}
              secureTextEntry
              autoCapitalize="none"
              style={[s.passwordInput, { borderColor: passwordError ? "#FF453A" : border, color: text }]}
            />
            {passwordError ? <Text style={s.passwordError}>{passwordError}</Text> : null}
            <View style={s.passwordButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowPasswordPrompt(false);
                  setDeletePassword("");
                  setPasswordError(null);
                }}
                style={[s.passwordBtn, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}
                disabled={reAuthLoading}
              >
                <Text style={[s.passwordBtnText, { color: sub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!token) return;
                  if (!user?.email) {
                    // Fallback: no email on record (e.g. non-email auth) – use existing flow
                    setShowPasswordPrompt(false);
                    setDeletePassword("");
                    setPasswordError(null);
                    await confirmDeleteAccount();
                    return;
                  }
                  if (!deletePassword.trim()) {
                    setPasswordError("Enter your password");
                    return;
                  }
                  setReAuthLoading(true);
                  try {
                    const { signInWithEmail } = await import("../services/firebaseAuth");
                    await signInWithEmail(user.email, deletePassword);
                    setShowPasswordPrompt(false);
                    setDeletePassword("");
                    setPasswordError(null);
                    await confirmDeleteAccount();
                  } catch (err: any) {
                    const message = err?.message || "";
                    if (message.includes("auth/wrong-password")) {
                      setPasswordError("Incorrect password");
                    } else {
                      setPasswordError("Could not verify password. Try again.");
                    }
                  } finally {
                    setReAuthLoading(false);
                  }
                }}
                style={[s.passwordBtn, { backgroundColor: "#FF453A20" }]}
                disabled={reAuthLoading}
              >
                {reAuthLoading ? (
                  <ActivityIndicator size="small" color="#FF453A" />
                ) : (
                  <Text style={[s.passwordBtnText, { color: "#FF453A" }]}>Delete account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
  },
  passwordCard: {
    width: "100%",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
  },
  passwordTitle: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  passwordSub: { fontSize: 13, marginBottom: 12 },
  passwordInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  passwordError: { marginTop: 6, fontSize: 12, color: "#FF453A" },
  passwordButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 16 },
  passwordBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  passwordBtnText: { fontSize: 14, fontWeight: "600" },
});
