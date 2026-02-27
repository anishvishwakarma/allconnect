import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, MapMarkerProps } from "react-native-maps";
// Workaround: react-native-maps types omit React's built-in `key` prop
const AnyMarker = Marker as React.ComponentType<MapMarkerProps & { key?: React.Key; children?: React.ReactNode }>;
import * as Location from "expo-location";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { postsApi, requestsApi } from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";

const PRIMARY = "#E8751A";
const AUTO_REFRESH_INTERVAL_MS = 45000; // 45 seconds - auto-refresh to show new activities
const { height: SCREEN_H } = Dimensions.get("window");

const CATEGORIES = ["activity","need","selling","meetup","event","study","nightlife","other"] as const;
const WHEN_FILTERS = [
  { key: "today", label: "Today" },
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "Weekend" },
];

const CAT_COLORS: Record<string, string> = {
  activity: "#30D158", need: "#0A84FF", selling: "#FFD60A",
  meetup: "#BF5AF2", event: "#FF453A", study: "#32ADE6",
  nightlife: "#E8751A", other: "#636366",
};

function formatEventTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isDark } = useAppTheme();
  const alert = useAlert();
  const [region, setRegion] = useState({ latitude: 28.6139, longitude: 77.209, latitudeDelta: 0.05, longitudeDelta: 0.05 });
  const [pins, setPins] = useState<any[]>([]);
  const [selectedPin, setSelectedPin] = useState<any>(null);
  const [filter, setFilter] = useState<{ category?: string; when?: string }>({});
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const regionRef = useRef(region);
  regionRef.current = region;
  const mapRef = useRef<MapView>(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    const { latitude, longitude } = regionRef.current;
    const params: Record<string, string> = {};
    if (filter.category) params.category = filter.category;
    if (filter.when === "today") {
      const now = new Date(), end = new Date(); end.setHours(23,59,59);
      params.from = now.toISOString(); params.to = end.toISOString();
    } else if (filter.when === "tonight") {
      const start = new Date(); start.setHours(18,0,0);
      const end = new Date(); end.setDate(end.getDate()+1); end.setHours(5,0,0);
      params.from = start.toISOString(); params.to = end.toISOString();
    } else if (filter.when === "weekend") {
      const now = new Date(), sat = new Date(now); sat.setDate(now.getDate()+(6-now.getDay())); sat.setHours(0,0,0);
      const sun = new Date(sat); sun.setDate(sat.getDate()+1); sun.setHours(23,59,59);
      params.from = sat.toISOString(); params.to = sun.toISOString();
    }
    try { setPins(await postsApi.nearby(latitude, longitude, 15, params)); }
    catch { setPins([]); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  useEffect(() => {
    const id = setInterval(fetchPins, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPins]);

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert.show(
          "Location needed",
          "Enable location access in Settings to see events near you.",
          undefined,
          "info"
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setRegion((r) => ({ ...r, latitude, longitude }));
      setUserLocation({ latitude, longitude });
      setLocationGranted(true);
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("unavailable") || msg.includes("location") || msg.includes("services")) {
        alert.show(
          "Location unavailable",
          "Turn on location services in your device settings, then try again.",
          undefined,
          "error"
        );
      } else {
        alert.show("Location error", "Could not get your location. Try again later.", undefined, "error");
      }
    }
  }

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status === "granted") return getLocation();
      })
      .catch(() => {});
  }, []);

  async function handleJoin() {
    if (!selectedPin || !token) return;
    setReqLoading(true);
    try {
      await requestsApi.send(selectedPin.id);
      setReqDone(true);
    } catch (err: any) {
      alert.show("Something went wrong", "Could not send your request. Please try again.", undefined, "error");
    } finally { setReqLoading(false); }
  }

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
      >
        {pins.map((pin) => (
          <AnyMarker
            key={pin.id}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            onPress={() => {
              setSelectedPin(pin);
              setReqDone(false);
              // Momo-style: center map on selected pin for clear pin–card connection
              if (pin?.lat != null && pin?.lng != null) {
                mapRef.current?.animateToRegion({
                  latitude: pin.lat,
                  longitude: pin.lng,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 300);
              }
            }}
          >
            <View style={[s.markerOuter, { borderColor: CAT_COLORS[pin.category] || PRIMARY }]}>
              <View style={[s.markerInner, { backgroundColor: CAT_COLORS[pin.category] || PRIMARY }]} />
            </View>
          </AnyMarker>
        ))}
      </MapView>

      {/* ── Filter chips + Refresh ── */}
      <View style={[s.filtersContainer, { top: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => fetchPins()}
          disabled={loading}
          style={[s.refreshBtn, { backgroundColor: surface, borderColor: border }]}
        >
          <Ionicons name="refresh" size={18} color={loading ? sub : PRIMARY} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, flexDirection: "row", alignItems: "center" }}>
          {WHEN_FILTERS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => { setLoading(true); setFilter((f) => ({ ...f, when: f.when === key ? undefined : key })); }}
              style={[s.chip, { backgroundColor: filter.when === key ? PRIMARY : surface, borderColor: filter.when === key ? PRIMARY : border }]}
            >
              <Text style={[s.chipText, { color: filter.when === key ? "#fff" : text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <View style={[s.divider, { backgroundColor: border }]} />
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => { setLoading(true); setFilter((f) => ({ ...f, category: f.category === cat ? undefined : cat })); }}
              style={[s.chip, { backgroundColor: filter.category === cat ? CAT_COLORS[cat] : surface, borderColor: filter.category === cat ? CAT_COLORS[cat] : border }]}
            >
              <View style={[s.catDot, { backgroundColor: CAT_COLORS[cat] || "#636366", opacity: filter.category === cat ? 0 : 1 }]} />
              <Text style={[s.chipText, { color: filter.category === cat ? "#fff" : text }]} numberOfLines={1}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Location FAB ── */}
      {!locationGranted && (
        <TouchableOpacity onPress={getLocation} style={[s.fab, { backgroundColor: surface, borderColor: border, right: 20, bottom: (selectedPin ? 220 : 100) + insets.bottom }]}>
          <Ionicons name="locate-outline" size={20} color={PRIMARY} />
        </TouchableOpacity>
      )}

      {/* ── Loading indicator ── */}
      {loading && (
        <View style={[s.loadingBadge, { backgroundColor: surface, top: insets.top + 110 }]}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <Text style={[s.loadingText, { color: sub }]}>Refreshing...</Text>
        </View>
      )}

      {/* ── Pin detail card ── */}
      {selectedPin && (
        <View style={[s.pinCard, { backgroundColor: surface, borderColor: border, bottom: insets.bottom }]}>
          <View style={s.handle} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.pinTitle, { color: text }]} numberOfLines={2}>{selectedPin.title}</Text>
              <View style={[s.catBadge, { backgroundColor: (CAT_COLORS[selectedPin.category] || PRIMARY) + "18" }]}>
                <Text style={[s.catBadgeText, { color: CAT_COLORS[selectedPin.category] || PRIMARY }]}>
                  {selectedPin.category}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setSelectedPin(null)} style={[s.closeBtn, { backgroundColor: isDark ? "#2C2C2F" : "#F0F0F3" }]}>
              <Ionicons name="close" size={16} color={sub} />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: "row", gap: 16, marginBottom: 16 }}>
            <PinMeta icon="time-outline" value={formatEventTime(selectedPin.event_at ?? selectedPin.eventAt)} sub={sub} />
            <PinMeta icon="people-outline" value={`Max ${selectedPin.max_people ?? selectedPin.maxParticipants ?? "—"}`} sub={sub} />
            {userLocation && (
              <PinMeta icon="navigate-outline" value={`${getDistanceKm(userLocation.latitude, userLocation.longitude, selectedPin.lat, selectedPin.lng).toFixed(1)} km`} sub={sub} />
            )}
            {(selectedPin.cost_per_person ?? selectedPin.costPerPerson) > 0 && <PinMeta icon="cash-outline" value={`₹${selectedPin.cost_per_person ?? selectedPin.costPerPerson}`} sub={sub} />}
          </View>

          {reqDone ? (
            <View style={[s.successBanner, { backgroundColor: "#30D15818" }]}>
              <Ionicons name="checkmark-circle" size={18} color="#30D158" />
              <Text style={{ color: "#30D158", fontWeight: "600", marginLeft: 8 }}>Request sent! Waiting for approval.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => router.push(`/post/${selectedPin.id}`)}
                style={[s.outlineBtn, { borderColor: PRIMARY, flex: 1 }]}
              >
                <Text style={[s.outlineBtnText, { color: PRIMARY }]}>View Details</Text>
              </TouchableOpacity>
              {token && selectedPin.host_id !== user?.id && selectedPin.hostId !== user?.id && (
                <TouchableOpacity
                  onPress={handleJoin}
                  disabled={reqLoading}
                  style={[s.primaryBtn, { flex: 1.5 }]}
                >
                  {reqLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="person-add-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={s.primaryBtnText}>Request to Join</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {!token && (
                <TouchableOpacity onPress={() => router.push("/login")} style={[s.primaryBtn, { flex: 1.5 }]}>
                  <Text style={s.primaryBtnText}>Sign in to Join</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function PinMeta({ icon, value, sub }: { icon: any; value: string; sub: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color={sub} />
      <Text style={{ color: sub, fontSize: 12, fontWeight: "500" }}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  markerOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  markerInner: { width: 10, height: 10, borderRadius: 5 },
  filtersContainer: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    marginLeft: 16, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  catDot: { width: 7, height: 7, borderRadius: 3.5 },
  divider: { width: 1, height: 28, alignSelf: "center", marginHorizontal: 2 },
  fab: {
    position: "absolute", width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
  },
  loadingBadge: {
    position: "absolute", alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  loadingText: { fontSize: 13, fontWeight: "500" },
  pinCard: {
    position: "absolute", left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#AEAEB2", alignSelf: "center", marginBottom: 16 },
  pinTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, lineHeight: 24 },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catBadgeText: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginLeft: 12 },
  successBanner: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14 },
  outlineBtn: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  outlineBtnText: { fontWeight: "700", fontSize: 14 },
  primaryBtn: {
    backgroundColor: "#E8751A", borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    shadowColor: "#E8751A", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
