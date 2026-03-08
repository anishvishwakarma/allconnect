import { useState, useEffect } from "react";
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
import { useAuthStore } from "../../store/auth";
import { usersApi } from "../../services/api";
import { getInitials } from "../../utils/profile";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../../constants/config";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const { isDark } = useAppTheme();
  const alert = useAlert();

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token) {
      router.replace("/login");
      return;
    }
    setName(user?.name || "");
    setEmail(user?.email || "");
    setAvatarUri(user?.avatar_uri || null);
    usersApi.me().then((u) => {
      setName(u.name || "");
      setEmail(u.email || "");
      setAvatarUri(u.avatar_uri || null);
    }).catch(() => {});
  }, [hasHydrated, token, user?.name, user?.email, user?.avatar_uri]);

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
      updateUser({ avatar_uri });
      alert.show("Uploaded", "Photo uploaded. Tap Save to update your profile.", undefined, "success");
    } catch (err: any) {
      const msg = err?.message || "Upload failed. Try again.";
      const isStorage = msg.includes("Storage not configured") || msg.includes("Upload failed") || msg.includes("Image too large");
      alert.show(isStorage ? "Photo upload issue" : "Something went wrong", msg, undefined, "error");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function save() {
    if (!token) return;
    setSaving(true);
    try {
      let avatarUrl = user?.avatar_uri || null;
      if (avatarBase64) {
        const res = await usersApi.uploadAvatar(avatarBase64);
        avatarUrl = res.avatar_uri;
      }
      const u = await usersApi.update({
        name: name.trim() || undefined,
        avatar_uri: avatarUrl ?? undefined,
      });
      updateUser({ ...u, avatar_uri: avatarUrl ?? (u as { avatar_uri?: string })?.avatar_uri });
      alert.show("Saved", "Profile updated.", undefined, "success");
      router.back();
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
    <ScrollView style={[s.scroll, { backgroundColor: bg }]} contentContainerStyle={[s.content, { paddingTop: insets.top + 16, paddingBottom: getBottomInset(insets.bottom) + 24 }]}>
      <Text style={[s.title, { color: text }]}>Edit profile</Text>

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
          style={[s.uploadBtn, { backgroundColor: PRIMARY }]}
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

      <Text style={[s.label, { color: sub }]}>Name</Text>
      <TextInput
        placeholder="Your name"
        placeholderTextColor={sub}
        value={name}
        onChangeText={setName}
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
      />
      <Text style={[s.label, { color: sub }]}>Email</Text>
      <TextInput
        placeholder="email@example.com"
        placeholderTextColor={sub}
        value={email}
        editable={false}
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
      />
      <TouchableOpacity onPress={save} disabled={saving} style={[s.btn, { backgroundColor: PRIMARY }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Save</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 16 },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 28, fontWeight: "800" },
  avatarBadge: { position: "absolute", right: 0, top: 0, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
    minWidth: 160,
  },
  uploadBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  label: { fontSize: 14, marginBottom: 4 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginBottom: 16, borderWidth: 1 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
