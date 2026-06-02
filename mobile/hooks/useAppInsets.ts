import { useWindowDimensions } from "react-native";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getTopInset,
  getBottomInset,
  getTabBarBottomInset,
  getHorizontalInsets,
  TAB_BAR_CONTENT_HEIGHT,
  MAX_SCREEN_CONTENT_WIDTH,
  screenSafePadding,
  tabBarTotalHeight,
} from "../constants/config";

/**
 * Device-aware safe areas for all screens (phone, tablet, gesture nav, notches).
 * Use instead of raw `useSafeAreaInsets()` when laying out UI.
 */
const bootInsets = initialWindowMetrics?.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };

/** Prefer live insets; fall back to first-frame metrics so layout does not jump on frame 2. */
function stableInsets(live: { top: number; bottom: number; left: number; right: number }) {
  return {
    top: live.top > 0 ? live.top : bootInsets.top,
    bottom: live.bottom > 0 ? live.bottom : bootInsets.bottom,
    left: live.left > 0 ? live.left : bootInsets.left,
    right: live.right > 0 ? live.right : bootInsets.right,
  };
}

export function useAppInsets() {
  const live = useSafeAreaInsets();
  const raw = stableInsets(live);
  const { width } = useWindowDimensions();
  const top = getTopInset(raw.top);
  const bottom = getBottomInset(raw.bottom);
  const { left, right } = getHorizontalInsets(raw.left, raw.right);
  const tabBarBottomPadding = getTabBarBottomInset(raw.bottom);
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + tabBarBottomPadding;
  const isWideLayout = width >= 600;

  return {
    raw,
    top,
    bottom,
    left,
    right,
    tabBarHeight,
    tabBarBottomPadding,
    tabBarContentHeight: TAB_BAR_CONTENT_HEIGHT,
    isWideLayout,
    /** Centered column on tablets — use on ScrollView contentContainerStyle */
    contentColumnStyle: isWideLayout
      ? ({ maxWidth: MAX_SCREEN_CONTENT_WIDTH, alignSelf: "center" as const, width: "100%" as const })
      : {},
    screenPadding: (extra?: { top?: number; bottom?: number; horizontal?: number }) =>
      screenSafePadding(raw, extra),
  };
}
