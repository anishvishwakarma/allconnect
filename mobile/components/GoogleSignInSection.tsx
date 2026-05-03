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

export function isGoogleOAuthConfigured(): boolean {
  const g = Constants.expoConfig?.extra?.google as GoogleOAuthExtra | undefined;
  if (!g?.webClientId?.trim()) return false;
  if (Platform.OS === "web") return true;
  return !!(g.iosClientId?.trim() && g.androidClientId?.trim());
}

/**
 * Opens Google OAuth and returns an ID token for Firebase signInWithCredential.
 * Requires a dev/production build with scheme `allconnect` (Expo Go is unreliable for OAuth).
 */
export function GoogleSignInButton({
  onIdToken,
  disabled,
  borderColor,
  backgroundColor,
  textColor,
}: {
  onIdToken: (idToken: string) => void;
  disabled?: boolean;
  borderColor: string;
  backgroundColor: string;
  textColor: string;
}) {
  const extra = Constants.expoConfig?.extra?.google as GoogleOAuthExtra | undefined;
  const lastHandled = useRef<string | null>(null);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: extra?.webClientId || "",
    iosClientId: extra?.iosClientId || "",
    androidClientId: extra?.androidClientId || "",
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") return;
    if (response.type !== "success") return;
    const idToken =
      typeof response.params?.id_token === "string" ? response.params.id_token : "";
    if (!idToken) return;
    if (lastHandled.current === idToken) return;
    lastHandled.current = idToken;
    onIdToken(idToken);
  }, [response, onIdToken]);

  return (
    <TouchableOpacity
      style={[styles.googleBtn, { borderColor, backgroundColor }]}
      disabled={!request || disabled}
      onPress={() => {
        void promptAsync().catch(() => {});
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
