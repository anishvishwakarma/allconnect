import { Platform } from 'react-native';

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
  activity: '#22c55e',
  need: '#3b82f6',
  selling: '#eab308',
  meetup: '#a855f7',
  event: '#ef4444',
  study: '#06b6d4',
  nightlife: '#E8751A',
  other: '#E8751A',
};

export const FREE_POST_LIMIT = 5;

/** Use mock OTP when true; set EXPO_PUBLIC_USE_MOCK_OTP=false when backend OTP is live. */
export const USE_MOCK_OTP =
  (process.env.EXPO_PUBLIC_USE_MOCK_OTP as string | undefined) !== 'false';

/** India: mobile number must be exactly 10 digits (after +91) */
export const INDIA_MOBILE_LENGTH = 10;

/** Minimum bottom inset for Android so tab bar / content never touches system nav (home, back, recent). */
export const ANDROID_NAV_BAR_FALLBACK = 56;

/** Returns bottom inset, using fallback on Android when SafeArea reports 0. Use for tab bar and main app content. */
export function getBottomInset(bottom: number): number {
  return Math.max(bottom, Platform.OS === 'android' ? ANDROID_NAV_BAR_FALLBACK : 0);
}

/** Smaller bottom inset for login/register so there's no large grey strip above system nav. */
export function getContentBottomInset(bottom: number): number {
  return Math.max(bottom, Platform.OS === 'android' ? 12 : 0);
}

/** Public privacy policy URL (required for store listings; also used in-app for "View full policy"). */
export const PRIVACY_POLICY_URL = 'https://allpixel.in/privacy%20policy.html';

/** Where to send user after completing password reset (must be in Firebase Auth → Authorized domains). */
export const PASSWORD_RESET_CONTINUE_URL = 'https://allpixel.in/';
