import { useState } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  Switch, StyleSheet,
} from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { postsApi } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { POST_CATEGORIES } from "../../types";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";
const CAT_COLORS: Record<string, string> = {
  activity: "#30D158", need: "#0A84FF", selling: "#FFD60A",
  meetup: "#BF5AF2", event: "#FF453A", study: "#32ADE6",
  nightlife: "#E8751A", other: "#636366",
};

export default function CreatePostScreen() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isDark } = useAppTheme();
  const alert = useAlert();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [costPerPerson, setCostPerPerson] = useState("0");
  const [maxParticipants, setMaxParticipants] = useState("4");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";
  const inputBg = isDark ? "#252528" : "#F5F5F7";

  const postsMonth = user?.posts_this_month ?? 0;
  const subEnd = user?.subscription_ends_at;
  const freeRemaining = Math.max(0, 5 - postsMonth);
  const hasSubscription = subEnd && new Date(subEnd) > new Date();

  if (!token) {
    return (
      <View style={[s.center, { backgroundColor: bg }]}>
        <Ionicons name="add-circle-outline" size={56} color={PRIMARY} />
        <Text style={[s.emptyTitle, { color: text }]}>Sign in to post</Text>
        <Text style={[s.emptySub, { color: sub }]}>Share what you're doing and find people nearby</Text>
        <TouchableOpacity onPress={() => router.replace("/login")} style={s.cta}>
          <Text style={s.ctaText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function pickLocation() {
    setFetchingLoc(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { alert.show("Permission denied", "Location permission is required.", undefined, "info"); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo) setAddressText([geo.street, geo.district, geo.city].filter(Boolean).join(", "));
    } catch { alert.show("Something went wrong", "Could not get location. Please try again.", undefined, "error"); }
    finally { setFetchingLoc(false); }
  }

  async function submit() {
    if (!title.trim()) { alert.show("Required", "Add a title.", undefined, "info"); return; }
    if (!category) { alert.show("Required", "Select a category.", undefined, "info"); return; }
    if (lat == null || lng == null) { alert.show("Required", "Set your location.", undefined, "info"); return; }
    if (!eventAt) { alert.show("Required", "Set the event date and time.", undefined, "info"); return; }
    const eventDate = new Date(eventAt);
    if (isNaN(eventDate.getTime())) { alert.show("Invalid", "Use format: 2026-03-15T20:00", undefined, "info"); return; }
    if (eventDate < new Date()) { alert.show("Invalid", "Event must be in the future.", undefined, "info"); return; }
    if (!hasSubscription && freeRemaining <= 0) {
      alert.show("Limit reached", "You've used your 5 free posts this month. Upgrade to Pro for unlimited posts.", undefined, "info");
      return;
    }
    setLoading(true);
    try {
      const post = await postsApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        lat,
        lng,
        address_text: addressText.trim() || undefined,
        event_at: eventDate.toISOString(),
        duration_minutes: Number(durationMinutes) || 60,
        cost_per_person: Number(costPerPerson) || 0,
        max_people: Number(maxParticipants),
        privacy_type: approvalRequired ? "public" : "public",
      });
      alert.show("Posted!", "Your post is live on the map.", [
        { text: "View Post", onPress: () => router.push(`/post/${post.id}`) },
        { text: "Explore Map", onPress: () => router.replace("/(tabs)/map") },
      ], "success");
    } catch (err: any) {
      alert.show("Something went wrong", "Could not create post. Please try again.", undefined, "error");
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border }]}>
        <Text style={[s.title, { color: text }]}>Create Post</Text>
        {!hasSubscription && (
          <View style={[s.limitBadge, { backgroundColor: freeRemaining > 0 ? PRIMARY + "18" : "#FF453A18" }]}>
            <Ionicons name="flash" size={12} color={freeRemaining > 0 ? PRIMARY : "#FF453A"} />
            <Text style={[s.limitText, { color: freeRemaining > 0 ? PRIMARY : "#FF453A" }]}>
              {freeRemaining > 0 ? `${freeRemaining} free left` : "Limit reached"}
            </Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
        {/* Title */}
        <Section label="What's happening?" icon="megaphone-outline" iconColor={PRIMARY}>
          <TextInput
            value={title} onChangeText={setTitle}
            placeholder="E.g. Going to a rooftop party at 9 PM"
            placeholderTextColor={sub} maxLength={100}
            style={[s.input, { backgroundColor: inputBg, color: text, borderColor: title ? PRIMARY : border }]}
          />
        </Section>

        {/* Category */}
        <Section label="Category" icon="grid-outline" iconColor={PRIMARY}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
              {POST_CATEGORIES.map((cat) => {
                const c = CAT_COLORS[cat] || PRIMARY;
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat} onPress={() => setCategory(cat)}
                    style={[s.catChip, { backgroundColor: active ? c : inputBg, borderColor: active ? c : border }]}
                  >
                    <View style={[s.catDot, { backgroundColor: active ? "#fff" : c }]} />
                    <Text style={[s.catChipText, { color: active ? "#fff" : text }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </Section>

        {/* Description */}
        <Section label="Description" icon="document-text-outline" iconColor={sub}>
          <TextInput
            value={description} onChangeText={setDescription}
            placeholder="Add more details about your plan..."
            placeholderTextColor={sub} multiline numberOfLines={3} maxLength={1000}
            style={[s.input, s.textarea, { backgroundColor: inputBg, color: text, borderColor: border }]}
          />
        </Section>

        {/* Location */}
        <Section label="Location" icon="location-outline" iconColor={PRIMARY} required>
          <TouchableOpacity
            onPress={pickLocation}
            style={[s.locBtn, { backgroundColor: lat != null ? PRIMARY + "12" : inputBg, borderColor: lat != null ? PRIMARY : border }]}
          >
            {fetchingLoc ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Ionicons name={lat != null ? "location" : "location-outline"} size={18} color={PRIMARY} />
            )}
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[s.locPrimary, { color: lat != null ? PRIMARY : sub }]}>
                {lat != null ? "Location set" : "Use my current location"}
              </Text>
              {addressText ? <Text style={[s.locSub, { color: sub }]} numberOfLines={1}>{addressText}</Text> : null}
            </View>
            {lat == null && <Ionicons name="navigate-outline" size={16} color={sub} />}
            {lat != null && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
          </TouchableOpacity>
        </Section>

        {/* Date/Time + Duration in one row */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 2 }}>
            <Section label="Date & Time" icon="calendar-outline" iconColor={PRIMARY} required compact>
              <TextInput
                value={eventAt} onChangeText={setEventAt}
                placeholder="2026-03-15T20:00"
                placeholderTextColor={sub}
                style={[s.input, { backgroundColor: inputBg, color: text, borderColor: eventAt ? PRIMARY : border }]}
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section label="Duration (min)" icon="hourglass-outline" iconColor={sub} compact>
              <TextInput
                value={durationMinutes} onChangeText={setDurationMinutes}
                keyboardType="number-pad" placeholder="60" placeholderTextColor={sub}
                style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
              />
            </Section>
          </View>
        </View>

        {/* Cost + Max participants */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Section label="Cost/person" icon="cash-outline" iconColor={sub} compact>
              <TextInput
                value={costPerPerson} onChangeText={setCostPerPerson}
                keyboardType="number-pad" placeholder="0 = free" placeholderTextColor={sub}
                style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
              />
            </Section>
          </View>
          <View style={{ flex: 1 }}>
            <Section label="Max people" icon="people-outline" iconColor={sub} compact>
              <TextInput
                value={maxParticipants} onChangeText={setMaxParticipants}
                keyboardType="number-pad" placeholder="4" placeholderTextColor={sub}
                style={[s.input, { backgroundColor: inputBg, color: text, borderColor: border }]}
              />
            </Section>
          </View>
        </View>

        {/* Approval toggle */}
        <View style={[s.toggleCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={[s.toggleIcon, { backgroundColor: PRIMARY + "18" }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={PRIMARY} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[s.toggleTitle, { color: text }]}>Approval required</Text>
            <Text style={[s.toggleSub, { color: sub }]}>Manually approve each person who joins</Text>
          </View>
          <Switch
            value={approvalRequired} onValueChange={setApprovalRequired}
            trackColor={{ false: border, true: PRIMARY }}
            thumbColor="#fff" ios_backgroundColor={border}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity onPress={submit} disabled={loading} style={s.submitBtn} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.submitText}>Post to Map</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, icon, iconColor, children, required, compact }: any) {
  const { isDark } = useAppTheme();
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: compact ? 8 : 10 }}>
        <Ionicons name={icon} size={14} color={iconColor || sub} />
        <Text style={[s.sLabel, { color: sub }]}>{label}{required ? " *" : ""}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center" },
  emptySub: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  cta: { marginTop: 20, backgroundColor: "#E8751A", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  limitBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  limitText: { fontSize: 11, fontWeight: "700" },
  sLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  textarea: { minHeight: 88, textAlignVertical: "top" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catChipText: { fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  locBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 },
  locPrimary: { fontSize: 15, fontWeight: "600" },
  locSub: { fontSize: 12, marginTop: 2 },
  toggleCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  toggleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  toggleTitle: { fontSize: 15, fontWeight: "600" },
  toggleSub: { fontSize: 12, marginTop: 2 },
  submitBtn: {
    backgroundColor: "#E8751A", borderRadius: 18, paddingVertical: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    shadowColor: "#E8751A", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
