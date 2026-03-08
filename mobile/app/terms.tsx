import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";
import { useAppTheme } from "../context/ThemeContext";

export default function TermsScreen() {
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
        <Text style={[s.title, { color: text }]}>Terms of Use</Text>
        <View style={s.backBtn} />
      </View>

      <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[s.body, { color: sub }]}>
          By using AllConnect, you agree to use the service lawfully and respectfully.
        </Text>
        <Text style={[s.heading, { color: text }]}>Community behavior</Text>
        <Text style={[s.body, { color: sub }]}>
          Do not post illegal content, spam, harassment, fraud, or unsafe event information. Hosts are responsible for the accuracy of their event details.
        </Text>
        <Text style={[s.heading, { color: text }]}>Accounts</Text>
        <Text style={[s.body, { color: sub }]}>
          You are responsible for maintaining access to your login credentials and for activity that occurs through your account.
        </Text>
        <Text style={[s.heading, { color: text }]}>Availability</Text>
        <Text style={[s.body, { color: sub }]}>
          Features may change over time, and chat/event availability can depend on approvals, timing, and network connectivity.
        </Text>
        <Text style={[s.heading, { color: text }]}>Contact</Text>
        <Text style={[s.body, { color: sub }]}>
          For support or legal concerns, contact contact@allpixel.in.
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
