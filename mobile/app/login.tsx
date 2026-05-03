import { useState, useEffect, useCallback, useRef } from "react";
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
import * as WebBrowser from "expo-web-browser";
import type { User as FirebaseUser } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { GoogleSignInButton, isGoogleOAuthConfigured } from "../components/GoogleSignInSection";
import { useAppTheme } from "../context/ThemeContext";
import { useAlert } from "../context/AlertContext";
import { API_URL } from "../constants/config";
import { authApi } from "../services/api";
import { useAuthStore } from "../store/auth";
import {
  signUpWithEmail,
  signInWithEmail,
  getIdToken,
  sendPasswordReset,
  signInWithGoogleIdToken,
  signOutFirebase,
} from "../services/firebaseAuth";

WebBrowser.maybeCompleteAuthSession();

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
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
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
  const [googleMobileGate, setGoogleMobileGate] = useState(false);
  const [googleMobileInput, setGoogleMobileInput] = useState("");
  const pendingGoogleUserRef = useRef<FirebaseUser | null>(null);
  const googleOAuthReady = isGoogleOAuthConfigured();

    // Pre-wake server (Render cold start) when login screen mounts
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    fetch(`${API_URL}/health`, { method: "GET", signal: ctrl.signal })
      .catch(() => {})
      .finally(() => clearTimeout(t));
  }, []);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    router.replace(user?.name?.trim() ? "/(tabs)/map" : "/complete-profile");
  }, [hasHydrated, token, user?.name]);

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
      else if (msg.includes("Service temporarily unavailable") || msg.includes("Firebase not configured"))
        alert.show(
          "Server setup",
          "The app is being configured. Please try again in a minute or contact support.",
          undefined,
          "error"
        );
      else if (msg.includes("Verification failed") || msg.includes("Invalid or expired token"))
        alert.show("Sign in failed", "Could not verify your account. Check your internet and try again.", undefined, "error");
      else if (msg.includes("timed out"))
        alert.show(
          "Taking too long",
          "The server may be starting up. Please try again in a moment.",
          [{ text: "Cancel", style: "cancel" }, { text: "Retry", onPress: () => handleSignIn() }],
          "info"
        );
      else if (isRetryable)
        alert.show(
          "Connection issue",
          "The server may be starting up. Please try again.",
          [{ text: "Cancel", style: "cancel" }, { text: "Retry", onPress: () => handleSignIn() }],
          "info"
        );
      else
        alert.show("Sign in failed", msg || "Check your connection and try again.", undefined, "error");
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
      else if (msg.includes("Verification failed") || msg.includes("Invalid or expired token"))
        alert.show("Registration failed", "Could not verify your account. Check your internet and try again.", undefined, "error");
      else if (msg.includes("Service temporarily unavailable") || msg.includes("Firebase not configured"))
        alert.show(
          "Server setup",
          "The app is being configured. Please try again in a minute or contact support.",
          undefined,
          "error"
        );
      else if (msg.includes("timed out"))
        alert.show(
          "Taking too long",
          "The server may be starting up. Please try again in a moment.",
          [{ text: "Cancel", style: "cancel" }, { text: "Retry", onPress: () => handleSignUp() }],
          "info"
        );
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
      else if (msg.includes("Mobile number required"))
        alert.show("Required", "Please enter a valid 10-digit mobile number.", undefined, "info");
      else
        alert.show("Something went wrong", msg || "Check your connection and try again.", undefined, "error");
    } finally {
      clearTimeout(hintTimer);
      setLoading(false);
      setLoadingHint("");
    }
  }

  const onGoogleIdToken = useCallback(
    async (idToken: string) => {
      setLoading(true);
      setLoadingHint("");
      try {
        const cred = await signInWithGoogleIdToken(idToken);
        const idTok = await getIdToken(cred.user);
        try {
          const { token, user } = await authApi.firebaseLogin(idTok);
          setAuth(token, user);
          router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile");
        } catch (e: any) {
          const msg = e?.message || "";
          if (msg.includes("Mobile number required")) {
            pendingGoogleUserRef.current = cred.user;
            setGoogleMobileGate(true);
            setGoogleMobileInput("");
            return;
          }
          throw e;
        }
      } catch (err: any) {
        const msg = err?.message || "Google sign-in failed.";
        if (msg.includes("account-exists-with-different-credential"))
          alert.show(
            "Account exists",
            "This email is already registered with email and password. Sign in with email instead, or use the same Google account you used before.",
            [{ text: "OK", onPress: () => setMode("signin") }],
            "info"
          );
        else if (msg.includes("invalid-credential") || msg.includes("Invalid or expired token"))
          alert.show("Sign in failed", "Could not verify with Google. Try again.", undefined, "error");
        else if (msg.includes("Network") || msg.includes("Failed to fetch"))
          alert.show("Connection error", "Check your internet and try again.", undefined, "error");
        else if (msg.includes("Mobile number already"))
          alert.show("Mobile in use", "This mobile number is already registered.", undefined, "error");
        else if (msg.includes("Service temporarily unavailable") || msg.includes("Firebase not configured"))
          alert.show(
            "Server setup",
            "The app is being configured. Please try again in a minute or contact support.",
            undefined,
            "error"
          );
        else alert.show("Google sign-in", msg, undefined, "error");
      } finally {
        setLoading(false);
      }
    },
    [alert, setAuth]
  );

  async function submitGoogleMobile() {
    const u = pendingGoogleUserRef.current;
    if (!u) {
      setGoogleMobileGate(false);
      return;
    }
    const mob = normalizeMobile(googleMobileInput);
    if (!mob) {
      alert.show("Invalid mobile", "Please enter a valid 10-digit mobile number.", undefined, "info");
      return;
    }
    setLoading(true);
    try {
      const idTok = await getIdToken(u);
      const { token, user } = await authApi.firebaseLogin(idTok, mob);
      pendingGoogleUserRef.current = null;
      setGoogleMobileGate(false);
      setGoogleMobileInput("");
      setAuth(token, user);
      router.replace(user.name?.trim() ? "/(tabs)/map" : "/complete-profile");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("Mobile number already"))
        alert.show("Mobile in use", "This mobile number is already registered.", undefined, "error");
      else alert.show("Something went wrong", msg || "Please try again.", undefined, "error");
    } finally {
      setLoading(false);
    }
  }

  async function cancelGoogleMobile() {
    pendingGoogleUserRef.current = null;
    setGoogleMobileGate(false);
    setGoogleMobileInput("");
    await signOutFirebase();
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
        "We sent a password reset link to " + e + ". Open the email and tap the link (use it within 1 hour; open in your browser). If it says \"expired or already used\", come back here and tap \"Send reset link\" again to get a new one.",
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
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={[s.scrollContent, { paddingTop: 16, paddingBottom: 16 }]}
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
            {googleMobileGate ? (
              <>
                <Text style={[s.googleGateTitle, { color: textColor }]}>Almost done</Text>
                <Text style={[s.sectionSubtext, { color: subColor, marginBottom: 16 }]}>
                  Enter your 10-digit mobile number — same as when you sign up with email. We use it for your AllConnect account.
                </Text>
                <View
                  style={[
                    s.inputWrapper,
                    {
                      backgroundColor: inputBg,
                      borderColor: normalizeMobile(googleMobileInput).length >= 13 ? PRIMARY : borderColor,
                      flexDirection: "row",
                      alignItems: "center",
                    },
                  ]}
                >
                  <Text style={[s.mobilePrefix, { color: subColor }]}>+91 </Text>
                  <TextInput
                    value={googleMobileInput}
                    onChangeText={(t) => setGoogleMobileInput(t.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit number"
                    placeholderTextColor={isDark ? "#555" : "#C0C0C0"}
                    keyboardType="phone-pad"
                    maxLength={10}
                    style={[s.input, { color: textColor, flex: 1 }]}
                  />
                </View>
                <TouchableOpacity
                  onPress={submitGoogleMobile}
                  disabled={loading}
                  style={s.primaryButton}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.primaryButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelGoogleMobile} style={s.cancelGoogle} disabled={loading}>
                  <Text style={[s.linkText, { color: subColor }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {mode !== "forgot" && googleOAuthReady ? (
                  <>
                    <GoogleSignInButton
                      onIdToken={onGoogleIdToken}
                      disabled={loading}
                      borderColor={borderColor}
                      backgroundColor={inputBg}
                      textColor={textColor}
                    />
                    <View style={s.oauthOrRow}>
                      <View style={[s.oauthOrLine, { backgroundColor: borderColor }]} />
                      <Text style={[s.oauthOrText, { color: subColor }]}>or</Text>
                      <View style={[s.oauthOrLine, { backgroundColor: borderColor }]} />
                    </View>
                  </>
                ) : null}
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
            {mode === "forgot" && (
              <Text style={[s.forgotHint, { color: subColor }]}>
                We'll send a link to reset your password. Use it within 1 hour and open in your browser.
              </Text>
            )}

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
                <View style={[s.inputWrapper, { backgroundColor: inputBg, borderColor: normalizeMobile(mobile).length >= 13 ? PRIMARY : borderColor, flexDirection: "row", alignItems: "center" }]}>
                  <Text style={[s.mobilePrefix, { color: subColor }]}>+91 </Text>
                  <TextInput
                    value={mobile}
                    onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit number"
                    placeholderTextColor={isDark ? "#555" : "#C0C0C0"}
                    keyboardType="phone-pad"
                    maxLength={10}
                    style={[s.input, { color: textColor, flex: 1 }]}
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
              </>
            )}
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
    </View>
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
  mobilePrefix: { fontSize: 16, fontWeight: "600", marginRight: 2 },
  passwordToggle: { paddingLeft: 8 },
  forgotLink: { alignSelf: "flex-end", marginTop: 12 },
  forgotHint: { fontSize: 12, marginTop: 8, marginBottom: 4 },
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
  googleGateTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  oauthOrRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 4,
  },
  oauthOrLine: { flex: 1, height: StyleSheet.hairlineWidth },
  oauthOrText: { fontSize: 13, fontWeight: "600", marginHorizontal: 12 },
  cancelGoogle: { marginTop: 16, alignSelf: "center", paddingVertical: 8 },
});
