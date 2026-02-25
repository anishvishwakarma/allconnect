import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/auth";
import { usersApi } from "../services/api";
import { getInitials } from "../utils/profile";
import { useAppTheme } from "../context/ThemeContext";

const PRIMARY = "#E8751A";

export default function CompleteProfileScreen() {
  const { token, user, updateUser } = useAuthStore();
  const { isDark } = useAppTheme();
  const [name, setName] = useState(user?.name?.trim() || "");
  const [email, setEmail] = useState(user?.email?.trim() || "");
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_uri || null);
  const [saving, setSaving] = useState(false);

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
      Alert.alert("Permission needed", "Allow access to your photos to add a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function save() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      const u = await usersApi.update({
        name: trimmedName,
        email: email.trim() || undefined,
      });
      updateUser({
        ...u,
        avatar_uri: avatarUri ?? (u as { avatar_uri?: string })?.avatar_uri,
      });
      router.replace("/(tabs)/map");
    } catch (_) {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const initial = getInitials(name || user?.name);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={[s.title, { color: text }]}>Complete your profile</Text>
      <Text style={[s.subtitle, { color: sub }]}>Add your name, email and optional photo.</Text>

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

      <Text style={[s.label, { color: sub }]}>Full name *</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Anjali Verma"
        placeholderTextColor={sub}
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
        maxLength={60}
      />

      <Text style={[s.label, { color: sub }]}>Email (optional)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="your@email.com"
        placeholderTextColor={sub}
        keyboardType="email-address"
        autoCapitalize="none"
        style={[s.input, { backgroundColor: surface, color: text, borderColor: border }]}
      />

      <TouchableOpacity onPress={save} disabled={saving} style={[s.btn, { backgroundColor: PRIMARY }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.btnText}>Continue</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 24, paddingTop: 60, paddingBottom: 48 },
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
  avatarBadge: { position: "absolute", right: 4, bottom: 4, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 16 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
