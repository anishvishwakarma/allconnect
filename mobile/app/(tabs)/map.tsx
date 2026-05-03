import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Dimensions, TextInput, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, MapMarkerProps } from "react-native-maps";
// Workaround: react-native-maps types omit React's built-in `key` prop
const AnyMarker = Marker as React.ComponentType<MapMarkerProps & { key?: React.Key; children?: React.ReactNode }>;
import * as Location from "expo-location";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { postsApi, requestsApi, placesApi } from "../../services/api";
import { useAppTheme } from "../../context/ThemeContext";
import { useAlert } from "../../context/AlertContext";
import { getBottomInset, CATEGORY_COLORS } from "../../constants/config";

const PRIMARY = "#E8751A";
const AUTO_REFRESH_INTERVAL_MS = 45000;
const TAB_BAR_BASE_HEIGHT = 56;
const { height: SCREEN_H } = Dimensions.get("window");

const CATEGORIES = ["activity","need","selling","meetup","event","study","nightlife","other"] as const;
const WHEN_FILTERS = [
  { key: "today", label: "Today" },
  { key: "tonight", label: "Tonight" },
  { key: "weekend", label: "Weekend" },
];

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

const CATEGORY_MARKER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  activity: "bicycle",
  need: "heart",
  selling: "pricetag",
  meetup: "people",
  event: "calendar",
  study: "school",
  nightlife: "moon",
  other: "location",
};

const ms = StyleSheet.create({
  pinStack: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 58,
    height: 64,
  },
  pulseRing: {
    position: "absolute",
    top: 2,
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignSelf: "center",
  },
  pinUpper: { alignItems: "center" },
  pinBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 10,
  },
  pinBubbleInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -4,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});

function MapPinBubble({
  color,
  icon,
  selected,
  pulse,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  pulse: boolean;
}) {
  const drop = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    drop.setValue(-40);
    fade.setValue(0);
    ring.setValue(1);
    Animated.parallel([
      Animated.spring(drop, {
        toValue: 0,
        friction: 7,
        tension: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entrance only on mount / marker remount (keyed by id)
  }, []);

  useEffect(() => {
    if (!pulse) return;
    ring.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1.5, duration: 480, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 480, useNativeDriver: true }),
      ])
    );
    loop.start();
    const stop = setTimeout(() => {
      loop.stop();
      ring.setValue(1);
    }, 2600);
    return () => {
      loop.stop();
      clearTimeout(stop);
    };
  }, [pulse, ring]);

  const scale = selected ? 1.14 : 1;

  return (
    <Animated.View
      style={[
        ms.pinStack,
        {
          opacity: fade,
          transform: [{ translateY: drop }, { scale }],
        },
      ]}
      collapsable={false}
    >
      {pulse ? (
        <Animated.View
          style={[
            ms.pulseRing,
            {
              borderColor: color,
              transform: [{ scale: ring }],
              opacity: ring.interpolate({
                inputRange: [1, 1.5],
                outputRange: [0.5, 0.08],
              }),
            },
          ]}
        />
      ) : null}
      <View style={ms.pinUpper}>
        <View style={[ms.pinBubble, { borderColor: color, shadowColor: "#000000" }]}>
          <View style={[ms.pinBubbleInner, { backgroundColor: color }]}>
            <Ionicons name={icon} size={21} color="#FFFFFF" />
          </View>
        </View>
        <View style={[ms.pinTail, { borderTopColor: color }]} />
      </View>
    </Animated.View>
  );
}

function EventMapMarker({
  pin,
  selected,
  pulse,
  onPress,
}: {
  pin: { id: string; lat: number; lng: number; category?: string };
  selected: boolean;
  pulse: boolean;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    setTracksViewChanges(true);
    const delay = pulse ? 3400 : 1000;
    const t = setTimeout(() => setTracksViewChanges(false), delay);
    return () => clearTimeout(t);
  }, [pulse, pin.id, selected]);
  const color = CATEGORY_COLORS[pin.category ?? ""] || PRIMARY;
  const icon = CATEGORY_MARKER_ICONS[pin.category ?? ""] ?? "location";
  return (
    <AnyMarker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
    >
      <MapPinBubble color={color} icon={icon} selected={selected} pulse={pulse} />
    </AnyMarker>
  );
}

function DraftMapMarker({
  coordinate,
}: {
  coordinate: { latitude: number; longitude: number };
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracksViewChanges(false), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnyMarker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracksViewChanges}>
      <MapPinBubble color={PRIMARY} icon="add" selected={false} pulse={false} />
    </AnyMarker>
  );
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
  const [mapLoadError, setMapLoadError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [draftPin, setDraftPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const lastPinTapAtRef = useRef<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { id: string; title: string; address: string; lat: number; lng: number }[]
  >([]);
  const regionRef = useRef(region);
  const mapLoadCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  regionRef.current = region;
  const regionFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);
  const lastPinIdsRef = useRef<Set<string>>(new Set());
  const freshPinsClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [freshPinIds, setFreshPinIds] = useState<Set<string>>(new Set());

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
    try {
      const data = await postsApi.nearby(latitude, longitude, 15, params);
      const nextIds = new Set(data.map((p: { id: string }) => String(p.id)));
      if (lastPinIdsRef.current.size > 0) {
        const added: string[] = [];
        nextIds.forEach((id) => {
          if (!lastPinIdsRef.current.has(id)) added.push(id);
        });
        if (added.length) {
          if (freshPinsClearRef.current) clearTimeout(freshPinsClearRef.current);
          setFreshPinIds(new Set(added));
          freshPinsClearRef.current = setTimeout(() => {
            setFreshPinIds(new Set());
            freshPinsClearRef.current = null;
          }, 3200);
        }
      }
      lastPinIdsRef.current = nextIds;
      setPins(data);
    } catch {
      // Keep previous pins on network/API failure; loading state cleared below
    }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchPins(); }, [fetchPins]);

  useEffect(() => {
    lastPinIdsRef.current = new Set();
    setFreshPinIds(new Set());
    if (freshPinsClearRef.current) {
      clearTimeout(freshPinsClearRef.current);
      freshPinsClearRef.current = null;
    }
  }, [filter.category, filter.when]);

  useEffect(() => {
    const id = setInterval(fetchPins, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPins]);

  useEffect(() => {
    return () => {
      if (regionFetchTimeoutRef.current) clearTimeout(regionFetchTimeoutRef.current);
    };
  }, []);

  function scheduleFetchForRegion(nextRegion: typeof region) {
    setRegion(nextRegion);
    if (regionFetchTimeoutRef.current) clearTimeout(regionFetchTimeoutRef.current);
    regionFetchTimeoutRef.current = setTimeout(() => {
      regionRef.current = nextRegion;
      fetchPins();
    }, 350);
  }

  async function getLocation() {
    setLocating(true);
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
      // Use Balanced accuracy so "my location" returns in 1–3s instead of 10–30s (GPS-only)
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      const nextRegion = { ...regionRef.current, latitude, longitude };
      scheduleFetchForRegion(nextRegion);
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
    } finally {
      setLocating(false);
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
      const result = await requestsApi.send(selectedPin.id);
      setReqDone(true);
      if ((result as { status?: string } | undefined)?.status === "approved") {
        alert.show("Joined", "You're in. Open the post details to access the group chat.", undefined, "success");
      }
    } catch (err: any) {
      alert.show("Something went wrong", "Could not send your request. Please try again.", undefined, "error");
    } finally { setReqLoading(false); }
  }

  // If map doesn't signal ready within 12s, show "map couldn't load" (e.g. wrong API key or network)
  useEffect(() => {
    if (mapReady || mapLoadError) return;
    mapLoadCheckRef.current = setTimeout(() => setMapLoadError(true), 12000);
    return () => {
      if (mapLoadCheckRef.current) clearTimeout(mapLoadCheckRef.current);
    };
  }, [mapReady, mapLoadError]);

  const bg = isDark ? "#0C0C0F" : "#F5F5F7";
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const text = isDark ? "#FFFFFF" : "#0C0C0F";
  const sub = isDark ? "#9A9A9E" : "#6E6E73";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  function retryMap() {
    setMapLoadError(false);
    setMapReady(false);
    setMapKey((k) => k + 1);
  }

  async function searchPlacesOnMap() {
    const q = searchQuery.trim();
    if (!q) {
      alert.show("Search", "Type a place or area name to search.", undefined, "info");
      return;
    }
    setSearching(true);
    try {
      const center = regionRef.current;
      const results = await placesApi.search(q, {
        lat: center.latitude,
        lng: center.longitude,
        radiusKm: 30,
      });
      setSearchResults(results);
      if (!results.length) {
        alert.show("Search", "No matching places found. Try a different query.", undefined, "info");
        return;
      }
      // If user location is known, auto-pick the first result within our allowed radius.
      const candidate = userLocation
        ? results.find(
            (r) => r.lat != null && r.lng != null && getDistanceKm(userLocation.latitude, userLocation.longitude, r.lat, r.lng) <= 30
          ) ?? null
        : results[0] ?? null;

      if (candidate?.lat != null && candidate.lng != null) {
        const nextRegion = {
          latitude: candidate.lat,
          longitude: candidate.lng,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        };
        regionRef.current = { ...regionRef.current, ...nextRegion };
        setRegion((prev) => ({ ...prev, ...nextRegion }));
        mapRef.current?.animateToRegion(nextRegion, 400);
        // Show a draft pin where the search landed; user can then fine-tune details on Create.
        setDraftPin({ latitude: candidate.lat, longitude: candidate.lng });
      } else if (userLocation) {
        alert.show(
          "Too far away",
          "For now you can only create posts within about 30 km of your current area. Zoom closer and try again.",
          undefined,
          "info"
        );
      }
    } catch (err: any) {
      alert.show(
        "Search",
        "Could not search for places right now. Please try again.",
        undefined,
        "error"
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg, minHeight: SCREEN_H }}>
      <MapView
        key={mapKey}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={[StyleSheet.absoluteFillObject, { minHeight: SCREEN_H }]}
        mapPadding={{ bottom: TAB_BAR_BASE_HEIGHT + getBottomInset(insets.bottom), top: 0, left: 0, right: 0 }}
        region={region}
        mapType="standard"
        onRegionChangeComplete={scheduleFetchForRegion}
        onMapReady={() => { setMapReady(true); setMapLoadError(false); }}
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        onLongPress={(e) => {
          // Prevent MapView long-press from interfering with quick taps on existing pins.
          if (Date.now() - lastPinTapAtRef.current < 650) return;
          const coord = e.nativeEvent.coordinate;
          if (!coord) return;
          if (userLocation) {
            const dist = getDistanceKm(
              userLocation.latitude,
              userLocation.longitude,
              coord.latitude,
              coord.longitude
            );
            if (dist > 30) {
              alert.show(
                "Too far away",
                "For now you can only create posts within about 30 km of your area. Zoom closer to your city and long-press again.",
                undefined,
                "info"
              );
              return;
            }
          }
          setDraftPin({ latitude: coord.latitude, longitude: coord.longitude });
        }}
      >
        {draftPin && (
          <DraftMapMarker
            key={`${draftPin.latitude.toFixed(5)}_${draftPin.longitude.toFixed(5)}`}
            coordinate={draftPin}
          />
        )}
        {pins.map((pin) => (
          <EventMapMarker
            key={pin.id}
            pin={pin}
            selected={selectedPin?.id === pin.id}
            pulse={freshPinIds.has(String(pin.id))}
            onPress={() => {
              lastPinTapAtRef.current = Date.now();
              setDraftPin(null);
              setSelectedPin(pin);
              setReqDone(false);
              if (pin?.lat != null && pin?.lng != null) {
                mapRef.current?.animateToRegion({
                  latitude: pin.lat,
                  longitude: pin.lng,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 300);
              }
            }}
          />
        ))}
      </MapView>

      {/* ── Map load failed: show message + retry (e.g. APK: key in EAS production + SHA-1 in Google Cloud) ── */}
      {mapLoadError && (
        <View style={[s.mapErrorCard, { backgroundColor: surface, borderColor: border }]}>
          <Ionicons name="map-outline" size={28} color={sub} />
          <Text style={[s.mapErrorTitle, { color: text }]}>Map couldn't load</Text>
          <Text style={[s.mapErrorSub, { color: sub }]}>
            Check your connection. If using the installed app: set the Maps key in EAS (Production) and add your app's SHA-1 to the API key in Google Cloud Console.
          </Text>
          <TouchableOpacity onPress={retryMap} style={[s.mapErrorBtn, { backgroundColor: PRIMARY }]}>
            <Text style={s.mapErrorBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Search bar + Filter chips + Refresh ── */}
      <View style={[s.filtersContainer, { top: insets.top + 8 }]}>
        <View style={[s.searchBar, { backgroundColor: surface, borderColor: border }]}>
          <Ionicons name="search" size={16} color={sub} style={{ marginRight: 6 }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, alignItems: "center" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <TextInput
                value={searchQuery}
                onChangeText={(v) => {
                  setSearchQuery(v);
                  if (!v.trim()) setSearchResults([]);
                }}
                onSubmitEditing={searchPlacesOnMap}
                placeholder="Search places on map"
                placeholderTextColor={sub}
                style={[s.searchInput, { color: text }]}
              />
            </View>
          </ScrollView>
          <TouchableOpacity
            onPress={searchPlacesOnMap}
            disabled={searching}
            style={s.searchAction}
          >
            {searching ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Ionicons name="arrow-forward-circle" size={20} color={PRIMARY} />
            )}
          </TouchableOpacity>
        </View>
        {searchResults.length > 0 && (
          <View style={[s.searchResults, { backgroundColor: surface, borderColor: border }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {searchResults.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={s.searchResultRow}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (userLocation) {
                      const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, r.lat, r.lng);
                      if (dist > 30) {
                        alert.show(
                          "Too far away",
                          "For now you can only create posts within about 30 km of your current area.",
                          undefined,
                          "info"
                        );
                        return;
                      }
                    }
                    setSearchQuery(r.title);
                    setSearchResults([]);
                    const nextRegion = {
                      latitude: r.lat,
                      longitude: r.lng,
                      latitudeDelta: 0.03,
                      longitudeDelta: 0.03,
                    };
                    regionRef.current = { ...regionRef.current, ...nextRegion };
                    setRegion((prev) => ({ ...prev, ...nextRegion }));
                    mapRef.current?.animateToRegion(nextRegion, 400);
                    setDraftPin({ latitude: r.lat, longitude: r.lng });
                  }}
                >
                  <Ionicons name="location-outline" size={16} color={PRIMARY} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[s.searchResultTitle, { color: text }]} numberOfLines={1}>
                      {r.title}
                    </Text>
                    {!!r.address && (
                      <Text style={[s.searchResultAddress, { color: sub }]} numberOfLines={1}>
                        {r.address}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={s.filtersRow}>
          <TouchableOpacity
            onPress={() => fetchPins()}
            disabled={loading}
            style={[s.refreshBtn, { backgroundColor: surface, borderColor: border }]}
          >
            <Ionicons name="refresh" size={18} color={loading ? sub : PRIMARY} />
          </TouchableOpacity>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, gap: 8, flexDirection: "row", alignItems: "center" }}
          >
            {WHEN_FILTERS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  setLoading(true);
                  setFilter((f) => ({ ...f, when: f.when === key ? undefined : key }));
                }}
                style={[
                  s.chip,
                  {
                    backgroundColor: filter.when === key ? PRIMARY : surface,
                    borderColor: filter.when === key ? PRIMARY : border,
                  },
                ]}
              >
                <Text style={[s.chipText, { color: filter.when === key ? "#fff" : text }]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={[s.divider, { backgroundColor: border }]} />
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setLoading(true);
                  setFilter((f) => ({ ...f, category: f.category === cat ? undefined : cat }));
                }}
                style={[
                  s.chip,
                  {
                    backgroundColor: filter.category === cat ? CATEGORY_COLORS[cat] : surface,
                    borderColor: filter.category === cat ? CATEGORY_COLORS[cat] : border,
                  },
                ]}
              >
                <View
                  style={[
                    s.catDot,
                    {
                      backgroundColor: CATEGORY_COLORS[cat] || "#636366",
                      opacity: filter.category === cat ? 0 : 1,
                    },
                  ]}
                />
                <Text style={[s.chipText, { color: filter.category === cat ? "#fff" : text }]} numberOfLines={1}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* ── Location FAB (always visible so user can re-center; tap to go to current location) ── */}
      <TouchableOpacity onPress={getLocation} disabled={locating} style={[s.fab, { backgroundColor: surface, borderColor: border, right: 20, bottom: (selectedPin ? 220 : 100) + getBottomInset(insets.bottom) }]}>
        {locating ? <ActivityIndicator size="small" color={PRIMARY} /> : <Ionicons name="locate-outline" size={20} color={PRIMARY} />}
      </TouchableOpacity>

      {/* ── Loading indicator (hide when map failed so we don't show both) ── */}
      {loading && !mapLoadError && (
        <View style={[s.loadingBadge, { backgroundColor: surface, top: insets.top + 110 }]}>
          <ActivityIndicator size="small" color={PRIMARY} />
          <Text style={[s.loadingText, { color: sub }]}>Refreshing...</Text>
        </View>
      )}

      {/* ── Pin detail card (above tab bar so View Details is fully visible) ── */}
      {selectedPin && (
        <View style={[s.pinCard, { backgroundColor: surface, borderColor: border, bottom: TAB_BAR_BASE_HEIGHT + getBottomInset(insets.bottom) }]}>
          <View style={s.handle} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.pinTitle, { color: text }]} numberOfLines={2}>{selectedPin.title}</Text>
              <View style={[s.catBadge, { backgroundColor: (CATEGORY_COLORS[selectedPin.category] || PRIMARY) + "18" }]}>
                <Text style={[s.catBadgeText, { color: CATEGORY_COLORS[selectedPin.category] || PRIMARY }]}>
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
              <Text style={{ color: "#30D158", fontWeight: "600", marginLeft: 8 }}>
                {(selectedPin.privacy_type ?? selectedPin.privacyType) === "approval"
                  ? "Request sent! Waiting for approval."
                  : "Joined! Open details for the group chat."}
              </Text>
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
                      <Text style={s.primaryBtnText}>
                        {(selectedPin.privacy_type ?? selectedPin.privacyType) === "approval" ? "Request to Join" : "Join Now"}
                      </Text>
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
      {draftPin && !selectedPin && (
        <View style={[s.draftCard, { backgroundColor: surface, borderColor: border, bottom: TAB_BAR_BASE_HEIGHT + getBottomInset(insets.bottom) + 80 }]}>
          <Text style={[s.draftTitle, { color: text }]}>Create post here?</Text>
          <Text style={[s.draftSub, { color: sub }]}>
            Long-pressed location on the map. You can fine-tune details on the next screen.
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              onPress={() => setDraftPin(null)}
              style={[s.draftBtn, { backgroundColor: isDark ? "#252528" : "#F0F0F3" }]}
            >
              <Text style={[s.draftBtnText, { color: sub }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!token) {
                  setDraftPin(null);
                  router.push("/login");
                  return;
                }
                const coord = draftPin;
              if (userLocation) {
                const dist = getDistanceKm(userLocation.latitude, userLocation.longitude, coord.latitude, coord.longitude);
                if (dist > 30) {
                  alert.show(
                    "Too far away",
                    "For now you can only create posts within about 30 km of your current area. Zoom closer and try again.",
                    undefined,
                    "info"
                  );
                  return;
                }
              }
                setDraftPin(null);
                router.push({
                  pathname: "/(tabs)/create",
                  params: {
                    lat: String(coord.latitude),
                    lng: String(coord.longitude),
                  },
                });
              }}
              style={[s.draftBtn, { backgroundColor: PRIMARY }]}
            >
              <Text style={[s.draftBtnText, { color: "#fff" }]}>Create post</Text>
            </TouchableOpacity>
          </View>
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
  filtersContainer: { position: "absolute", left: 0, right: 0, paddingVertical: 8 },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  searchAction: { marginLeft: 6 },
  searchResults: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: 180,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  searchResultTitle: { fontSize: 13, fontWeight: "600" },
  searchResultAddress: { fontSize: 11, marginTop: 2 },
  filtersRow: { flexDirection: "row", alignItems: "center" },
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
    padding: 20, paddingBottom: 48,
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
  mapErrorCard: {
    position: "absolute",
    left: 20,
    right: 20,
    top: "30%",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  mapErrorTitle: { fontSize: 17, fontWeight: "700" },
  mapErrorSub: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  mapErrorBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, marginTop: 4 },
  mapErrorBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  draftCard: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  draftTitle: { fontSize: 15, fontWeight: "700" },
  draftSub: { fontSize: 12, marginTop: 4 },
  draftBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  draftBtnText: { fontSize: 13, fontWeight: "600" },
});
