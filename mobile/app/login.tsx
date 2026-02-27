import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useAlert } from "../context/AlertContext";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(input: string): boolean {
  return EMAIL_REGEX.test((input || "").trim());
}

function normalizeMobile(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length >= 10) return "+91" + digits.slice(-10);
  return "";
}

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState("");

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
      alert.show("Required", "Please enter your email and password.", undefined, "info");
      return;
    }
    if (!isEmail(e)) {
      alert.show("Invalid email", "Please enter a valid email address.", undefined, "info");
      return;
    }
    if (p.length < 6) {
      alert.show("Invalid password", "Password must be at least 6 characters.", undefined, "info");
      return;
    }
    setLoading(true);
    setLoadingHint("");
    const hintTimer = setTimeout(() => setLoadingHint("Taking longer? Server may be waking up…"), 4000);
    try {
      const cred = await signInWithEmail(e, p);
      setLoadingHint("Almost there…");
      const idToken = await getIdToken(cred.user);
      const { token, user } = await authApi.firebaseLogin(idToken);
      setAuth(token, user);
      router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile");
    } catch (err: any) {
      const msg = err?.message || "Sign in failed.";
      const isRetryable =
        msg.includes("Network") ||
        msg.includes("token") ||
        msg.includes("Verification") ||
        msg.includes("Request failed");
      if (
        msg.includes("user-not-found") ||
        msg.includes("wrong-password") ||
        msg.includes("invalid-credential") ||
        msg.includes("404")
      )
        alert.show("Sign in failed", "Invalid email or password.", undefined, "error");
      else if (msg.includes("Too many attempts"))
        alert.show("Try again later", "Too many login attempts. Please wait a few minutes.", undefined, "info");
      else if (msg.includes("email-not-verified"))
        alert.show("Email not verified", "Check your inbox and verify your email first.", undefined, "info");
      else if (isRetryable)
        alert.show(
          "Connection issue",
          "The server may be starting up. Please try again.",
          [{ text: "Cancel", style: "cancel" }, { text: "Retry", onPress: () => handleSignIn() }],
          "info"
        );
      else alert.show("Sign in failed", "Something went wrong. Please try again.", undefined, "error");
    } finally {
      clearTimeout(hintTimer);
      setLoading(false);
      setLoadingHint("");
    }
  }

  async function handleSignUp() {
    const e = email.trim().toLowerCase();
    const m = mobile.trim();
    const p = password;
    if (!e || !m || !p) {
      alert.show("Required", "Please enter your email, mobile number and password.", undefined, "info");
      return;
    }
    if (!isEmail(e)) {
      alert.show("Invalid email", "Please enter a valid email address.", undefined, "info");
      return;
    }
    const mob = normalizeMobile(m);
    if (!mob) {
      alert.show("Invalid mobile", "Please enter a valid 10-digit mobile number.", undefined, "info");
      return;
    }
    if (p.length < 6) {
      alert.show("Invalid password", "Password must be at least 6 characters.", undefined, "info");
      return;
    }
    setLoading(true);
    setLoadingHint("");
    const hintTimer = setTimeout(() => setLoadingHint("Taking longer? Server may be waking up…"), 4000);
    try {
      const cred = await signUpWithEmail(e, p);
      setLoadingHint("Almost there…");
      const idToken = await getIdToken(cred.user);
      const { token, user } = await authApi.firebaseLogin(idToken, mob); // mobile linked to email for messaging
      setAuth(token, user);
      alert.show(
        "Account created",
        "We sent a verification link to your email. You can continue now and verify later.",
        [{ text: "Continue", onPress: () => router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile") }],
        "success"
      );
    } catch (err: any) {
      const msg = err?.message || "Sign up failed.";
      const isRetryable =
        msg.includes("Network") ||
        msg.includes("token") ||
        msg.includes("Verification") ||
        msg.includes("Request failed");
      if (msg.includes("email-already-in-use"))
        alert.show(
          "Already registered",
          "An account with this email already exists. Sign in to continue.",
          [{ text: "Sign in", onPress: () => setMode("signin") }],
          "info"
        );
      else if (msg.includes("Mobile number already"))
        alert.show("Mobile in use", "This mobile number is already registered.", undefined, "error");
      else if (msg.includes("weak-password"))
        alert.show("Weak password", "Use at least 6 characters.", undefined, "info");
      else if (isRetryable)
        alert.show(
          "Connection issue",
          "The server may be starting up. Please try again.",
          [{ text: "Cancel", style: "cancel" }, { text: "Retry", onPress: () => handleSignUp() }],
          "info"
        );
      else if (msg.includes("Invalid") || msg.includes("token") || msg.includes("Verification"))
        alert.show(
          "Registration issue",
          "Your account may have been created. Try signing in with your email and password.",
          [{ text: "Sign in", onPress: () => setMode("signin") }],
          "info"
        );
      else alert.show("Something went wrong", "Please try again or contact support.", undefined, "error");
    } finally {
      clearTimeout(hintTimer);
      setLoading(false);
      setLoadingHint("");
    }
  }

  async function handleForgotPassword() {
    const e = email.trim().toLowerCase();
    if (!e) {
      alert.show("Required", "Please enter your email address.", undefined, "info");
      return;
    }
    if (!isEmail(e)) {
      alert.show("Invalid email", "Please enter a valid email address.", undefined, "info");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordReset(e);
      alert.show(
        "Check your email",
        "We sent a password reset link to your email. Check your inbox and spam folder.",
        undefined,
        "success"
      );
      setMode("signin");
    } catch (err: any) {
      const msg = err?.message || "Could not send reset email.";
      if (msg.includes("user-not-found") || msg.includes("404"))
        alert.show("Not found", "No account found for this email.", undefined, "error");
      else if (msg.includes("Too many attempts"))
        alert.show("Try again later", "Too many attempts. Please wait a few minutes.", undefined, "info");
      else if (msg.includes("Network error"))
        alert.show("Connection error", "Check your internet connection and try again.", undefined, "error");
      else alert.show("Something went wrong", "Could not send reset email. Please try again.", undefined, "error");
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
            <View style={[s.inputWrapper, { backgroundColor: inputBg, borderColor: isEmail(email) ? PRIMARY : borderColor }]}>
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

            {mode === "signup" && (
              <>
                <View style={s.sectionHeader}>
                  <View style={[s.sectionIcon, { backgroundColor: PRIMARY_LIGHT }]}>
                    <Ionicons name="call-outline" size={18} color={PRIMARY} />
                  </View>
                  <View>
                    <Text style={[s.sectionTitle, { color: textColor }]}>Mobile number</Text>
                    <Text style={[s.sectionSubtext, { color: subColor }]}>Linked to your email for messaging</Text>
                  </View>
                </View>
                <View style={[s.inputWrapper, { backgroundColor: inputBg, borderColor: normalizeMobile(mobile).length >= 13 ? PRIMARY : borderColor }]}>
                  <TextInput
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={isDark ? "#555" : "#C0C0C0"}
                    keyboardType="phone-pad"
                    style={[s.input, { color: textColor }]}
                  />
                </View>
              </>
            )}

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
                    secureTextEntry={!showPassword}
                    style={[s.input, { color: textColor }]}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={s.passwordToggle}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color={subColor}
                    />
                  </TouchableOpacity>
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
              <View>
                <TouchableOpacity
                  onPress={handleSignUp}
                  disabled={loading}
                  style={s.primaryButton}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[s.primaryButtonText, { marginLeft: 10 }]}>Creating account…</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.primaryButtonText}>Create account</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>
                {loadingHint ? (
                  <Text style={[s.loadingHint, { color: subColor }]}>{loadingHint}</Text>
                ) : null}
              </View>
            ) : (
              <View>
                <TouchableOpacity
                  onPress={handleSignIn}
                  disabled={loading}
                  style={s.primaryButton}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={[s.primaryButtonText, { marginLeft: 10 }]}>Signing in…</Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.primaryButtonText}>Sign in</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </>
                  )}
                </TouchableOpacity>
                {loadingHint ? (
                  <Text style={[s.loadingHint, { color: subColor }]}>{loadingHint}</Text>
                ) : null}
              </View>
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
                onPress={() => {
                  setMode(mode === "forgot" ? "signin" : mode === "signup" ? "signin" : "signup");
                  if (mode === "signup") setMobile("");
                }}
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
  sectionSubtext: { fontSize: 12, marginTop: 2 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 16 : 10,
  },
  input: { flex: 1, fontSize: 16, fontWeight: "500" },
  passwordToggle: { paddingLeft: 8 },
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
  loadingHint: { fontSize: 12, marginTop: 10, textAlign: "center" },
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
