import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";
import { useAppTheme } from "../context/ThemeContext";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useAppTheme();
  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: getBottomInset(insets.bottom) + 24, paddingHorizontal: 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: text }]}>Privacy Policy</Text>
        <View style={s.backBtn} />
      </View>

      <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[s.body, { color: sub }]}>
          AllConnect collects only the information needed to provide nearby events, joining requests, chat, profile display, and app security.
        </Text>
        <Text style={[s.heading, { color: text }]}>What we store</Text>
        <Text style={[s.body, { color: sub }]}>
          Your email, mobile number, display name, profile photo, posts, join requests, chat messages, and device push token may be stored to operate the service.
        </Text>
        <Text style={[s.heading, { color: text }]}>How it is used</Text>
        <Text style={[s.body, { color: sub }]}>
          We use your data to authenticate you, show your posts, approve participation, deliver messages, and send app notifications relevant to your activity.
        </Text>
        <Text style={[s.heading, { color: text }]}>Account deletion</Text>
        <Text style={[s.body, { color: sub }]}>
          You can request deletion from Settings. Deleting your account removes your app profile and associated data from AllConnect.
        </Text>
        <Text style={[s.heading, { color: text }]}>Contact</Text>
        <Text style={[s.body, { color: sub }]}>
          For privacy requests or questions, contact `support@allconnect.app`.
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
  },
  heading: { fontSize: 16, fontWeight: "700", marginTop: 6 },
  body: { fontSize: 14, lineHeight: 21 },
});
