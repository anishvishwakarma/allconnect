import { useEffect, useRef, type ReactNode } from "react";
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getBottomInset } from "../constants/config";

type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = "100%", height, borderRadius = 8, style }: SkeletonProps) {
  const { isDark } = useAppTheme();
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? "#2C2C2F" : "#E5E5EA",
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

function SkeletonRows({ children, bottomPad = 40 }: { children: ReactNode; bottomPad?: number }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ padding: 16, gap: 10, paddingBottom: getBottomInset(insets.bottom) + bottomPad }}>
      {children}
    </View>
  );
}

export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  const { isDark } = useAppTheme();
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  return (
    <SkeletonRows>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[sk.card, { backgroundColor: surface, borderColor: border }]}>
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={[sk.flex, { marginLeft: 14 }]}>
            <Skeleton width="68%" height={14} borderRadius={6} />
            <Skeleton width="42%" height={11} borderRadius={5} style={{ marginTop: 10 }} />
            <Skeleton width="36%" height={11} borderRadius={5} style={{ marginTop: 8 }} />
          </View>
          <Skeleton width={28} height={28} borderRadius={14} />
        </View>
      ))}
    </SkeletonRows>
  );
}

export function HistoryListSkeleton({ count = 5 }: { count?: number }) {
  const { isDark } = useAppTheme();
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";
  const accent = isDark ? "#3C3C3F" : "#D1D1D6";

  return (
    <SkeletonRows>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[sk.historyCard, { backgroundColor: surface, borderColor: border }]}>
          <View style={[sk.accent, { backgroundColor: accent }]} />
          <View style={[sk.flex, { paddingVertical: 14, paddingRight: 12 }]}>
            <View style={sk.historyTop}>
              <Skeleton width="55%" height={14} borderRadius={6} />
              <Skeleton width={52} height={18} borderRadius={8} />
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10, paddingLeft: 12 }}>
              <Skeleton width={56} height={18} borderRadius={6} />
              <Skeleton width={88} height={12} borderRadius={5} />
            </View>
            <Skeleton width={48} height={11} borderRadius={5} style={{ marginTop: 10, marginLeft: 12 }} />
          </View>
          <Skeleton width={16} height={16} borderRadius={4} style={{ marginRight: 12 }} />
        </View>
      ))}
    </SkeletonRows>
  );
}

export function NotificationListSkeleton({ count = 6 }: { count?: number }) {
  const { isDark } = useAppTheme();
  const surface = isDark ? "#1A1A1F" : "#FFFFFF";
  const border = isDark ? "#2C2C2F" : "#E5E5EA";

  return (
    <SkeletonRows>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[sk.notifCard, { backgroundColor: surface, borderColor: border }]}>
          <Skeleton width={30} height={30} borderRadius={15} />
          <View style={[sk.flex, { marginLeft: 10 }]}>
            <Skeleton width={88} height={16} borderRadius={8} />
            <Skeleton width="82%" height={13} borderRadius={5} style={{ marginTop: 10 }} />
            <Skeleton width="60%" height={11} borderRadius={5} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={11} borderRadius={5} style={{ marginTop: 8 }} />
            <Skeleton width={100} height={10} borderRadius={5} style={{ marginTop: 10 }} />
          </View>
        </View>
      ))}
    </SkeletonRows>
  );
}

const sk = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  flex: { flex: 1 },
  accent: { width: 4, alignSelf: "stretch" },
  historyTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 12,
    paddingRight: 8,
  },
});
