import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/auth";
import { usersApi } from "../services/api";
import { getInitials } from "../utils/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";
import { useAppTheme } from "../context/ThemeContext";
import { useAlert } from "../context/AlertContext";

const PRIMARY = "#E8751A";

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { token, user, updateUser, hasHydrated } = useAuthStore();
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const [name, setName] = useState(user?.name?.trim() || "");
  const [email, setEmail] = useState(user?.email?.trim() || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_uri || null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!hasHydrated) {
    return null;
  }

  if (!token) {
    router.replace("/login");
    return null;
  }

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      alert.show("Permission needed", "Allow access to your photos to add a profile picture.", undefined, "info");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarUri(asset.uri);
      setAvatarBase64(asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null);
    }
  }

  async function uploadImage() {
    if (!avatarBase64) return;
    setUploadingAvatar(true);
    try {
      const { avatar_uri } = await usersApi.uploadAvatar(avatarBase64);
      setAvatarUri(avatar_uri);
      setAvatarBase64(null);
      alert.show("Uploaded", "Photo uploaded. Tap Continue to save your profile.", undefined, "success");
    } catch (err: any) {
      const msg = err?.message || "Upload failed. Try again.";
      const isStorage = msg.includes("Storage not configured") || msg.includes("Upload failed") || msg.includes("Image too large");
      alert.show(isStorage ? "Photo upload issue" : "Something went wrong", msg, undefined, "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert.show("Required", "Please enter your name.", undefined, "info");
      return;
    }
    setSaving(true);
    try {
      let finalAvatarUri = user?.avatar_uri || null;
      if (avatarBase64) {
        const { avatar_uri } = await usersApi.uploadAvatar(avatarBase64);
        finalAvatarUri = avatar_uri;
      }
      const u = await usersApi.update({
        name: trimmedName,
        avatar_uri: finalAvatarUri ?? undefined,
      });
      updateUser({
        ...u,
        avatar_uri: finalAvatarUri ?? (u as { avatar_uri?: string })?.avatar_uri,
      });
      router.replace("/(tabs)/map");
    } catch (err: any) {
      const msg = err?.message || "Could not save. Please try again.";
      const isStorage = msg.includes("Storage not configured") || msg.includes("Upload failed") || msg.includes("Image too large");
      alert.show(
        isStorage ? "Photo upload issue" : "Something went wrong",
        msg,
        undefined,
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  const initial = getInitials(name || user?.name);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={[s.content, { paddingTop: insets.top + 24, paddingBottom: getBottomInset(insets.bottom) + 24 }]} keyboardShouldPersistTaps="handled">
      <Text style={[s.title, { color: text }]}>Complete your profile</Text>
      <Text style={[s.subtitle, { color: sub }]}>Add your name and optional photo.</Text>

      <TouchableOpacity onPress={pickImage} style={[s.avatarWrap, { borderColor: border, backgroundColor: surface }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={s.avatarImage} />
        ) : (
          <View style={[s.avatarPlaceholder, { backgroundColor: PRIMARY + "20" }]}>
            <Text style={[s.avatarInitial, { color: PRIMARY }]}>{initial}</Text>
          </View>
        )}
        <View style={[s.avatarBadge, { backgroundColor: PRIMARY }]}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
      </TouchableOpacity>

      {avatarBase64 ? (
        <TouchableOpacity
          onPress={uploadImage}
          disabled={uploadingAvatar}
          style={[s.uploadBtn, { backgroundColor: PRIMARY, borderColor: border }]}
        >
          {uploadingAvatar ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.uploadBtnText}>Upload photo</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      <Text style={[s.label, { color: sub }]}>Full name *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Anjali Verma"
        placeholderTextColor={sub}
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
        maxLength={60}
      />

      <Text style={[s.label, { color: sub }]}>Email</Text>
      <TextInput
        value={email}
        editable={false}
        placeholder="your@email.com"
        placeholderTextColor={sub}
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
      />

      <TouchableOpacity onPress={save} disabled={saving} style={[s.btn, { backgroundColor: PRIMARY }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 24 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: { fontSize: 14, marginBottom: 24 },
  avatarWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignSelf: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 40, fontWeight: "800" },
  avatarBadge: { position: "absolute", right: 4, top: 4, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    minWidth: 160,
  },
  uploadBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
