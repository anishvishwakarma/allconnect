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
import { GoogleGIcon } from "./GoogleGIcon";

WebBrowser.maybeCompleteAuthSession();

/** Shown when Google OAuth is unavailable — never expose DEVELOPER_ERROR / setup text to users. */
export const GOOGLE_SIGNIN_UNAVAILABLE_MSG =
  "Google sign-in is coming in the next update. Please use email sign-in for now.";

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

function isSignInCancelled(e: unknown): boolean {
  const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
  return code === "SIGN_IN_CANCELLED" || code === "12501";
}

function notifyGoogleError(onError: ((message: string) => void) | undefined, e?: unknown) {
  if (e && isSignInCancelled(e)) return;
  onError?.(GOOGLE_SIGNIN_UNAVAILABLE_MSG);
}

function validateGoogleClientIds(extra: GoogleOAuthExtra | undefined): string | null {
  const web = extra?.webClientId?.trim() || "";
  const android = extra?.androidClientId?.trim() || "";
  if (web && android && web === android) {
    return "misconfigured";
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

/** Browser OAuth fallback when native SDK fails. */
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

  if (!clientId) throw new Error("unavailable");

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
    throw new Error("unavailable");
  }
  const idToken = typeof result.params?.id_token === "string" ? result.params.id_token : "";
  if (!idToken) throw new Error("unavailable");
  return idToken;
}

function GoogleSignInButtonContent({ textColor }: { textColor: string }) {
  return (
    <View style={styles.row}>
      <GoogleGIcon size={22} />
      <Text style={[styles.googleBtnText, { color: textColor, marginLeft: 10 }]}>Continue with Google</Text>
    </View>
  );
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
      notifyGoogleError(onError);
      return;
    }
    if (response.type !== "success") return;
    const idToken =
      typeof response.params?.id_token === "string" ? response.params.id_token : "";
    if (!idToken) {
      notifyGoogleError(onError);
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
        if (validateGoogleClientIds(extra)) {
          notifyGoogleError(onError);
          return;
        }
        void promptAsync().catch((e) => notifyGoogleError(onError, e));
      }}
      activeOpacity={0.85}
    >
      <GoogleSignInButtonContent textColor={textColor} />
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
    if (validateGoogleClientIds(extra)) return;
    let cancelled = false;
    void (async () => {
      try {
        const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
        if (cancelled) return;
        GoogleSignin.configure(buildGoogleSignInConfig(extra));
      } catch {
        /* ignore — user sees friendly message only if sign-in fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [extra?.webClientId, extra?.iosClientId, extra?.androidClientId]);

  async function handlePress() {
    const web = extra?.webClientId?.trim();
    if (!web || validateGoogleClientIds(extra)) {
      notifyGoogleError(onError);
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
        notifyGoogleError(onError);
        return;
      }
      onIdToken(idToken);
    } catch (e: unknown) {
      if (isSignInCancelled(e)) return;

      try {
        const idToken = await signInWithGoogleBrowser();
        onIdToken(idToken);
        return;
      } catch (fallbackErr: unknown) {
        if (isSignInCancelled(fallbackErr)) return;
      }

      notifyGoogleError(onError, e);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.googleBtn, { borderColor, backgroundColor }]}
      disabled={disabled}
      onPress={() => void handlePress()}
      activeOpacity={0.85}
    >
      <GoogleSignInButtonContent textColor={textColor} />
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
