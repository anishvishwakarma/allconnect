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

/**
 * Bottom safe inset from the OS (navigation bar / home indicator / tablet taskbar).
 * When there is no system nav inset, this is 0 — layout can use the full height.
 * When back / home / recent (or gesture bar / iPhone home indicator) is present, use the returned value so UI does not overlap.
 */
export function getBottomInset(bottom: number): number {
  return Math.max(0, bottom);
}

/** Public privacy policy URL (required for store listings; also used in-app for "View full policy"). */
export const PRIVACY_POLICY_URL = 'https://allpixel.in/privacy%20policy.html';

/**
 * After reset in the browser, Firebase redirects here. Must be a real HTTPS page (Firebase requirement).
 * Host `web/password-reset-done.html` from the repo at this path on your site (or change URL + deploy).
 * Firebase Console → Authentication → Settings → Authorized domains → include the hostname (e.g. allpixel.in).
 */
export const PASSWORD_RESET_CONTINUE_URL = 'https://allpixel.in/password-reset-done.html';
