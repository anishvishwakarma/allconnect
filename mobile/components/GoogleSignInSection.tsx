import { useEffect, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, Platform, View } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import {
  AuthRequest,
  ResponseType,
  fetchDiscoveryAsync,
  makeRedirectUri,
} from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";

WebBrowser.maybeCompleteAuthSession();

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
  return true;
}

function isDeveloperError(e: unknown): boolean {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return code === "10" || /DEVELOPER_ERROR|developer console is not set up correctly/i.test(msg);
}

function formatDeveloperError(): string {
  return (
    "Google Sign-In is not linked to this app install (SHA-1 mismatch).\n\n" +
    "1. Firebase Console → Project settings → Your Android app (com.allconnect.app)\n" +
    "2. Add SHA-1 from Play Console → Setup → App integrity → App signing key certificate\n" +
    "3. Also add EAS upload keystore SHA-1: run in mobile/ → npx eas credentials -p android\n" +
    "4. Download google-services.json into mobile/ and run a new EAS production build\n\n" +
    "See mobile/GOOGLE_SIGNIN_SETUP.md for details."
  );
}

function validateGoogleClientIds(extra: GoogleOAuthExtra | undefined): string | null {
  const web = extra?.webClientId?.trim() || "";
  const android = extra?.androidClientId?.trim() || "";
  if (web && android && web === android) {
    return "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the Web client ID from Firebase, not the Android client ID.";
  }
  return null;
}

function buildGoogleSignInConfig(extra: GoogleOAuthExtra | undefined) {
  const web = extra?.webClientId?.trim() || "";
  const config: {
    webClientId: string;
    iosClientId?: string;
    offlineAccess: boolean;
  } = {
    webClientId: web,
    offlineAccess: false,
  };
  if (Platform.OS === "ios") {
    const ios = extra?.iosClientId?.trim();
    if (ios && ios !== web) config.iosClientId = ios;
  }
  return config;
}

/** Browser OAuth fallback (e.g. when native SDK hits DEVELOPER_ERROR on misconfigured SHA-1). */
async function signInWithGoogleBrowser(): Promise<string> {
  const extra = getGoogleExtra();
  const web = extra?.webClientId?.trim() || "";
  const android = extra?.androidClientId?.trim() || "";
  const ios = extra?.iosClientId?.trim() || "";

  const clientId =
    Platform.OS === "android"
      ? android || web
      : Platform.OS === "ios"
        ? (ios && ios !== web ? ios : web)
        : web;

  if (!clientId) throw new Error("Google Sign-In is not configured.");

  const redirectUri = makeRedirectUri({ scheme: "allconnect" });
  const discovery = await fetchDiscoveryAsync("https://accounts.google.com");
  const request = new AuthRequest({
    clientId,
    scopes: ["openid", "profile", "email"],
    redirectUri,
    responseType: ResponseType.IdToken,
  });

  const result = await request.promptAsync(discovery);
  if (result.type === "cancel" || result.type === "dismiss") {
    throw Object.assign(new Error("cancelled"), { code: "SIGN_IN_CANCELLED" });
  }
  if (result.type !== "success") {
    throw new Error("Google sign-in was cancelled or failed.");
  }
  const idToken = typeof result.params?.id_token === "string" ? result.params.id_token : "";
  if (!idToken) {
    throw new Error("No ID token from Google. Check OAuth client and redirect URIs in Google Cloud Console.");
  }
  return idToken;
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
      onError?.(isDeveloperError({ message: desc }) ? formatDeveloperError() : desc);
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
        const configErr = validateGoogleClientIds(extra);
        if (configErr) {
          onError?.(configErr);
          return;
        }
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
    const configErr = validateGoogleClientIds(extra);
    if (configErr) {
      onError?.(configErr);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
        if (cancelled) return;
        GoogleSignin.configure(buildGoogleSignInConfig(extra));
      } catch (e: unknown) {
        if (!cancelled) onError?.(e instanceof Error ? e.message : "Google Sign-In configuration failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extra?.webClientId, extra?.iosClientId, extra?.androidClientId, onError]);

  async function handlePress() {
    const web = extra?.webClientId?.trim();
    if (!web) {
      onError?.("Google Sign-In is not configured.");
      return;
    }
    const configErr = validateGoogleClientIds(extra);
    if (configErr) {
      onError?.(configErr);
      return;
    }

    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
      GoogleSignin.configure(buildGoogleSignInConfig(extra));
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
        onError?.(
          "No ID token. Add your app SHA-1 in Firebase, use the Web client ID as EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and rebuild."
        );
        return;
      }
      onIdToken(idToken);
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
      if (code === "SIGN_IN_CANCELLED" || code === "12501") return;

      if (isDeveloperError(e)) {
        try {
          const idToken = await signInWithGoogleBrowser();
          onIdToken(idToken);
          return;
        } catch (fallbackErr: unknown) {
          const fallbackCode =
            typeof fallbackErr === "object" && fallbackErr !== null && "code" in fallbackErr
              ? String((fallbackErr as { code?: string }).code)
              : "";
          if (fallbackCode === "SIGN_IN_CANCELLED") return;
        }
        onError?.(formatDeveloperError());
        return;
      }

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
