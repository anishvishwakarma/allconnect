import { useEffect, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, Platform, View } from "react-native";
import Constants from "expo-constants";
import * as Google from "expo-auth-session/providers/google";
import { Ionicons } from "@expo/vector-icons";

export type GoogleOAuthExtra = {
  webClientId?: string;
  iosClientId?: string;
  androidClientId?: string;
};

function getGoogleExtra(): GoogleOAuthExtra | undefined {
  return Constants.expoConfig?.extra?.google as GoogleOAuthExtra | undefined;
}

/** Web / Expo Go: browser OAuth. Production native builds: @react-native-google-signin (Play Services / iOS SDK). */
export function isGoogleOAuthConfigured(): boolean {
  const g = getGoogleExtra();
  if (!g?.webClientId?.trim()) return false;
  if (Platform.OS === "web") return true;
  if (Platform.OS === "ios") return !!g.iosClientId?.trim();
  // Android native Google Sign-In only needs Web client ID for Firebase idToken; ensure Android OAuth client + SHA-1 exist in Google Cloud.
  return true;
}

function GoogleSignInBrowser({
  onIdToken,
  disabled,
  borderColor,
  backgroundColor,
  textColor,
  onError,
}: {
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  onError?: (message: string) => void;
}) {
  const extra = getGoogleExtra();
  const lastHandled = useRef<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: extra?.webClientId || "",
    iosClientId: extra?.iosClientId || "",
    androidClientId: extra?.androidClientId || "",
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") {
      const desc =
        typeof response.params?.error_description === "string"
          ? response.params.error_description
          : typeof response.error?.message === "string"
            ? response.error.message
            : response.error?.toString?.() || "Google sign-in was cancelled or failed.";
      onError?.(desc);
      return;
    }
    if (response.type !== "success") return;
    const idToken =
      typeof response.params?.id_token === "string" ? response.params.id_token : "";
    if (!idToken) {
      onError?.("No ID token from Google. Check OAuth consent screen and redirect URIs in Google Cloud Console.");
      return;
    }
    if (lastHandled.current === idToken) return;
    lastHandled.current = idToken;
    onIdToken(idToken);
  }, [response, onIdToken, onError]);

  return (
    <TouchableOpacity
      style={[styles.googleBtn, { borderColor, backgroundColor }]}
      disabled={!request || disabled}
      onPress={() => {
        void promptAsync().catch((e) => onError?.(e?.message || "Could not open Google sign-in."));
      }}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <Ionicons name="logo-google" size={22} color="#4285F4" />
        <Text style={[styles.googleBtnText, { color: textColor, marginLeft: 10 }]}>Continue with Google</Text>
      </View>
    </TouchableOpacity>
  );
}

function GoogleSignInNative({
  onIdToken,
  disabled,
  borderColor,
  backgroundColor,
  textColor,
  onError,
}: {
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  onError?: (message: string) => void;
}) {
  const extra = getGoogleExtra();

  useEffect(() => {
    const web = extra?.webClientId?.trim();
    if (!web || Constants.appOwnership === "expo") return;
    let cancelled = false;
    void (async () => {
      try {
        const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
        if (cancelled) return;
        GoogleSignin.configure({
          webClientId: web,
          iosClientId: extra?.iosClientId?.trim() || undefined,
          offlineAccess: false,
        });
      } catch (e: unknown) {
        if (!cancelled) onError?.(e instanceof Error ? e.message : "Google Sign-In configuration failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extra?.webClientId, extra?.iosClientId, onError]);

  async function handlePress() {
    const web = extra?.webClientId?.trim();
    if (!web) {
      onError?.("Google Sign-In is not configured.");
      return;
    }
    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
      GoogleSignin.configure({
        webClientId: web,
        iosClientId: extra?.iosClientId?.trim() || undefined,
        offlineAccess: false,
      });
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (response.type !== "success") return;
      let idToken = response.data.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }
      if (!idToken) {
        onError?.("No ID token. In Google Cloud Console, add your app’s SHA-1 to the Android OAuth client and use the Web client ID from Firebase as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.");
        return;
      }
      onIdToken(idToken);
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "SIGN_IN_CANCELLED" || code === "12501") return;
      const msg = e instanceof Error ? e.message : "Google sign-in failed.";
      onError?.(msg);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.googleBtn, { borderColor, backgroundColor }]}
      disabled={disabled}
      onPress={() => void handlePress()}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <Ionicons name="logo-google" size={22} color="#4285F4" />
        <Text style={[styles.googleBtnText, { color: textColor, marginLeft: 10 }]}>Continue with Google</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Native production builds use Google Play / iOS SDK (reliable with Firebase).
 * Expo Go and web keep expo-auth-session (may hit OAuth browser restrictions).
 */
export function GoogleSignInButton({
  onIdToken,
  disabled,
  borderColor,
  backgroundColor,
  textColor,
  onError,
}: {
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
  /** Shown when the user-facing Google flow fails before onIdToken. */
  onError?: (message: string) => void;
}) {
  const useBrowser = Platform.OS === "web" || Constants.appOwnership === "expo";
  if (useBrowser) {
    return (
      <GoogleSignInBrowser
        onIdToken={onIdToken}
        disabled={disabled}
        borderColor={borderColor}
        backgroundColor={backgroundColor}
        textColor={textColor}
        onError={onError}
      />
    );
  }
  return (
    <GoogleSignInNative
      onIdToken={onIdToken}
      disabled={disabled}
      borderColor={borderColor}
      backgroundColor={backgroundColor}
      textColor={textColor}
      onError={onError}
    />
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  googleBtnText: { fontSize: 16, fontWeight: "600" },
});
