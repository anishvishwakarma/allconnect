import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";
import { useAppTheme } from "../context/ThemeContext";

const PRIMARY = "#E8751A";

export default function HelpScreen() {
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
        <Text style={[s.title, { color: text }]}>Help & FAQ</Text>
        <View style={s.backBtn} />
      </View>

      <View style={[s.card, { backgroundColor: surface, borderColor: border }]}>
        <Text style={[s.heading, { color: text }]}>Getting started</Text>
        <Text style={[s.body, { color: sub }]}>
          Sign in, complete your profile, explore the map, and join activities near you. Public posts let you join instantly,
          while approval posts wait for the host to approve your request.
        </Text>

        <Text style={[s.heading, { color: text }]}>Posting an event</Text>
        <Text style={[s.body, { color: sub }]}>
          Use the Post tab, set your location, choose date and time, then add participant count and privacy settings before publishing.
        </Text>

        <Text style={[s.heading, { color: text }]}>Chat access</Text>
        <Text style={[s.body, { color: sub }]}>
          Group chats open only for approved participants and automatically expire after the event ends.
        </Text>

        <Text style={[s.heading, { color: text }]}>Need support?</Text>
        <Text style={[s.body, { color: sub }]}>
          Contact us at contact@allpixel.in for login issues, account deletion help, or reportable abuse.
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
