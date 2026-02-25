import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../context/ThemeContext";
import { authApi } from "../services/api";
import { useAuthStore } from "../store/auth";
import {
  signUpWithEmail,
  signInWithEmail,
  getIdToken,
  sendPasswordReset,
} from "../services/firebaseAuth";

const PRIMARY = "#E8751A";
const PRIMARY_LIGHT = "#FFF3E8";

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#FAFAFA";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const textColor = isDark ? "#FFFFFF" : "#111111";
  const subColor = isDark ? "#9A9A9E" : "#6E6E73";
  const borderColor = isDark ? "#2C2C2F" : "#E5E5EA";
  const inputBg = isDark ? "#252528" : "#F5F5F7";

  async function handleSignIn() {
    const e = email.trim().toLowerCase();
    const p = password;
    if (!e || !p) {
      Alert.alert("Required", "Enter email and password.");
      return;
    }
    if (p.length < 6) {
      Alert.alert("Invalid", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signInWithEmail(e, p);
      const idToken = await getIdToken(cred.user);
      const { token, user } = await authApi.firebaseLogin(idToken);
      setAuth(token, user);
      router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile");
    } catch (err: any) {
      const msg = err?.message || "Sign in failed.";
      if (msg.includes("user-not-found") || msg.includes("wrong-password"))
        Alert.alert("Sign in failed", "Invalid email or password.");
      else if (msg.includes("email-not-verified"))
        Alert.alert("Email not verified", "Check your inbox and verify your email first.");
      else
        Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp() {
    const e = email.trim().toLowerCase();
    const p = password;
    if (!e || !p) {
      Alert.alert("Required", "Enter email and password.");
      return;
    }
    if (p.length < 6) {
      Alert.alert("Invalid", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const cred = await signUpWithEmail(e, p);
      const idToken = await getIdToken(cred.user);
      const { token, user } = await authApi.firebaseLogin(idToken);
      setAuth(token, user);
      Alert.alert(
        "Verify your email",
        "We sent a verification link to your email. You can continue now and verify later."
      );
      router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile");
    } catch (err: any) {
      const msg = err?.message || "Sign up failed.";
      if (msg.includes("email-already-in-use"))
        Alert.alert("Email in use", "An account with this email already exists. Try signing in.");
      else if (msg.includes("weak-password"))
        Alert.alert("Weak password", "Use at least 6 characters.");
      else
        Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const e = email.trim().toLowerCase();
    if (!e) {
      Alert.alert("Required", "Enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(e);
      Alert.alert(
        "Check your email",
        "We sent a password reset link to your email. Check your inbox and spam folder."
      );
      setMode("signin");
    } catch (err: any) {
      const msg = err?.message || "Could not send reset email.";
      if (msg.includes("user-not-found"))
        Alert.alert("Not found", "No account exists with this email.");
      else
        Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[s.root, { backgroundColor: bg }]}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Brand */}
          <View style={s.brandArea}>
            <View style={s.logoContainer}>
              <Image source={require("../assets/icon.png")} style={s.logo} resizeMode="contain" />
            </View>
            <Text style={[s.appName, { color: textColor }]}>AllConnect</Text>
            <Text style={[s.tagline, { color: subColor }]}>
              {mode === "forgot"
                ? "Reset your password"
                : mode === "signup"
                ? "Create your account"
                : "Sign in to continue"}
            </Text>
          </View>

          {/* Card */}
          <View style={[s.card, { backgroundColor: surface, borderColor: borderColor }]}>
            <View style={s.sectionHeader}>
              <View style={[s.sectionIcon, { backgroundColor: PRIMARY_LIGHT }]}>
                <Ionicons name="mail-outline" size={18} color={PRIMARY} />
              </View>
              <Text style={[s.sectionTitle, { color: textColor }]}>Email</Text>
            </View>
            <View style={[s.inputWrapper, { backgroundColor: inputBg, borderColor: email.includes("@") ? PRIMARY : borderColor }]}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                placeholderTextColor={isDark ? "#555" : "#C0C0C0"}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[s.input, { color: textColor }]}
              />
            </View>

            {mode !== "forgot" && (
              <>
                <View style={s.sectionHeader}>
                  <View style={[s.sectionIcon, { backgroundColor: PRIMARY_LIGHT }]}>
                    <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
                  </View>
                  <Text style={[s.sectionTitle, { color: textColor }]}>Password</Text>
                </View>
                <View style={[s.inputWrapper, { backgroundColor: inputBg, borderColor: password.length >= 6 ? PRIMARY : borderColor }]}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={isDark ? "#555" : "#C0C0C0"}
                    secureTextEntry
                    style={[s.input, { color: textColor }]}
                  />
                </View>
              </>
            )}

            {mode === "signin" && (
              <TouchableOpacity onPress={() => setMode("forgot")} style={s.forgotLink}>
                <Text style={[s.linkText, { color: PRIMARY }]}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            {mode === "forgot" ? (
              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={loading}
                style={s.primaryButton}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.primaryButtonText}>Send reset link</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : mode === "signup" ? (
              <TouchableOpacity
                onPress={handleSignUp}
                disabled={loading}
                style={s.primaryButton}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.primaryButtonText}>Create account</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={loading}
                style={s.primaryButton}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.primaryButtonText}>Sign in</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={s.switchMode}>
              <Text style={[s.switchText, { color: subColor }]}>
                {mode === "forgot"
                  ? "Remember your password? "
                  : mode === "signup"
                  ? "Already have an account? "
                  : "Don't have an account? "}
              </Text>
              <TouchableOpacity
                onPress={() => setMode(mode === "forgot" ? "signin" : mode === "signup" ? "signin" : "signup")}
              >
                <Text style={[s.linkText, { color: PRIMARY }]}>
                  {mode === "forgot" ? "Sign in" : mode === "signup" ? "Sign in" : "Sign up"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.footerDivider}>
              <View style={[s.dividerLine, { backgroundColor: borderColor }]} />
            </View>
            <Text style={[s.footerText, { color: subColor }]}>Allpixel Technologies</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandArea: { alignItems: "center", marginBottom: 32 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#FFF3E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#E8751A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: { width: 56, height: 56, borderRadius: 14 },
  appName: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  tagline: { fontSize: 15, marginTop: 6, textAlign: "center", lineHeight: 22 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 16 : 10,
  },
  input: { flex: 1, fontSize: 16, fontWeight: "500" },
  forgotLink: { alignSelf: "flex-end", marginTop: 12 },
  linkText: { fontSize: 14, fontWeight: "600" },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  switchMode: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    alignItems: "center",
  },
  switchText: { fontSize: 14 },
  footer: {
    alignItems: "center",
    marginTop: 36,
    paddingBottom: 8,
  },
  footerDivider: { width: 40, marginBottom: 12 },
  dividerLine: { height: 1 },
  footerText: { fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
});
