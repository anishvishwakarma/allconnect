import { Platform } from "react-native";

/** REST + Socket base URL. Set EXPO_PUBLIC_API_URL in .env. Default: production (localhost only works when running backend locally) */
export const API_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined)?.trim() || 'https://allconnect.onrender.com';

export const SOCKET_URL = API_URL;

export const COLORS = {
  primary: '#E8751A',
  primaryLight: '#F5A95A',
  primaryDark: '#C45E0E',
  dark: {
    background: '#0F0F0F',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    text: '#FFFFFF',
    textMuted: 'rgba(235,235,245,0.6)',
    border: '#38383A',
  },
  light: {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    text: '#000000',
    textMuted: 'rgba(60,60,67,0.6)',
    border: '#C6C6C8',
  },
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  activity: '#30D158',
  need: '#0A84FF',
  selling: '#FFD60A',
  meetup: '#BF5AF2',
  event: '#FF453A',
  study: '#32ADE6',
  nightlife: '#E8751A',
  other: '#E8751A',
};

/** Total posts allowed per month on free plan (5 initial + 15 bonus). */
export const FREE_POST_LIMIT = 20;

/** Use mock OTP when true; set EXPO_PUBLIC_USE_MOCK_OTP=false when backend OTP is live. */
export const USE_MOCK_OTP =
  (process.env.EXPO_PUBLIC_USE_MOCK_OTP as string | undefined) !== 'false';

/** India: mobile number must be exactly 10 digits (after +91) */
export const INDIA_MOBILE_LENGTH = 10;

/** Tab bar content height (excluding OS bottom inset). */
export const TAB_BAR_CONTENT_HEIGHT = 56;

/** Max content width on tablets / wide phones — keeps forms readable, centered. */
export const MAX_SCREEN_CONTENT_WIDTH = 720;

type EdgeInsets = { top: number; bottom: number; left: number; right: number };

/**
 * Top inset: status bar, notch, Dynamic Island, tablet status area.
 * Fallback when edge-to-edge Android reports 0.
 */
export function getTopInset(top: number): number {
  const raw = Math.max(0, top);
  if (raw > 0) return raw;
  if (Platform.OS === "android") return 28;
  return 0;
}

/**
 * Bottom inset: home indicator, gesture nav, 3-button nav, tablet taskbar.
 * Fallback when edge-to-edge Android reports 0 (avoids overlap with system UI).
 */
export function getBottomInset(bottom: number): number {
  const raw = Math.max(0, bottom);
  if (raw > 0) return Math.max(raw, Platform.OS === "android" ? 8 : 4);
  if (Platform.OS === "android") return 28;
  if (Platform.OS === "ios") return 12;
  return 0;
}

export function getHorizontalInsets(left: number, right: number): { left: number; right: number } {
  return { left: Math.max(0, left), right: Math.max(0, right) };
}

/** Standard screen padding from OS safe areas (phones, notches, tablets, landscape). */
export function screenSafePadding(
  insets: EdgeInsets,
  extra?: { top?: number; bottom?: number; horizontal?: number }
) {
  const h = getHorizontalInsets(insets.left, insets.right);
  const padH = extra?.horizontal ?? 0;
  return {
    paddingTop: getTopInset(insets.top) + (extra?.top ?? 0),
    paddingBottom: getBottomInset(insets.bottom) + (extra?.bottom ?? 0),
    paddingLeft: h.left + padH,
    paddingRight: h.right + padH,
  };
}

export function tabBarTotalHeight(bottomInset: number): number {
  return TAB_BAR_CONTENT_HEIGHT + getBottomInset(bottomInset);
}

/** Public privacy policy URL (required for store listings; also used in-app for "View full policy"). */
export const PRIVACY_POLICY_URL = 'https://allpixel.in/privacy%20policy.html';

/**
 * After reset in the browser, Firebase redirects here. Must be a real HTTPS page (Firebase requirement).
 * Host `web/password-reset-done.html` from the repo at this path on your site (or change URL + deploy).
 * Firebase Console → Authentication → Settings → Authorized domains → include the hostname (e.g. allpixel.in).
 */
export const PASSWORD_RESET_CONTINUE_URL = 'https://allpixel.in/password-reset-done.html';
