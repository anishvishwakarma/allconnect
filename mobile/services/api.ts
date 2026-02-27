import { API_URL } from '../constants/config';
import { useAuthStore } from '../store/auth';
import type { Post, JoinRequest, GroupChat, Message, User } from '../types';

const DEFAULT_TIMEOUT_MS = 15000;
const AUTH_TIMEOUT_MS = 45000; // Render cold start can take 30–60s

async function request<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const msg =
      e instanceof Error && e.name === 'AbortError'
        ? 'Request timed out. The server may be starting up—please try again.'
        : e instanceof Error &&
          (e.message === 'Failed to fetch' || e.message?.includes('Network request failed'))
        ? 'Network error. Check your connection and try again.'
        : (e instanceof Error ? e.message : 'Request failed');
    throw new Error(msg);
  }
  clearTimeout(timeoutId);

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().logout();
    }
    // Don't clear token on 503 (server config) — user may retry
    const err = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: string }).error : undefined;
    throw new Error(err || `HTTP ${res.status}`);
  }
  return data as T;
}

// Auth with retry for cold start (Render free tier sleeps 30–60s after inactivity)
const AUTH_RETRY_DELAYS_MS = [6000, 12000, 18000]; // 6s, 12s, 18s between retries
const AUTH_MAX_RETRIES = 3;

async function authRequestWithRetry<T>(
  fn: () => Promise<T>,
  retries = AUTH_MAX_RETRIES
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const isLast = i === retries;
      const msg = e?.message || '';
      // Never retry auth failures (401) or server config (503)
      const isAuthOrConfigFailure =
        msg.includes('Invalid or expired token') ||
        msg.includes('Invalid email or password') ||
        msg.includes('Service temporarily unavailable') ||
        msg.includes('Firebase not configured');
      const isRetryable =
        !isAuthOrConfigFailure &&
        (msg.includes('Network') ||
          msg.includes('Failed to fetch') ||
          msg.includes('timed out') ||
          msg.includes('Request failed'));
      if (!isRetryable || isLast) throw e;
      const delay = AUTH_RETRY_DELAYS_MS[i] ?? 6000;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Request failed');
}

// ── Auth ───────────────────────────────────────────────
export const authApi = {
  // Email/password auth (Firebase) — mobile optional, required at registration
  firebaseLogin: (idToken: string, mobile?: string) =>
    authRequestWithRetry(() =>
      request<{ token: string; user: User }>('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify(mobile ? { idToken, mobile } : { idToken }),
        timeoutMs: AUTH_TIMEOUT_MS,
      })
    ),
  // Get email for login-by-mobile (rate limited)
  getEmailForLogin: (mobile: string) =>
    request<{ email: string }>(`/api/auth/email-for-login?mobile=${encodeURIComponent(mobile)}`),
  // OTP auth (kept for future mobile login - not shown in UI for now)
  sendOtp: (mobile: string) =>
    request<{ success: boolean }>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile: mobile.trim() }),
    }),
  verifyOtp: (mobile: string, code: string) =>
    request<{ token: string; user: User }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile: mobile.trim(), code: code.trim() }),
    }),
};

// ── Users ────────────────────────────────────────────────
export const usersApi = {
  me: () => request<User>('/api/users/me'),
  update: (data: { name?: string; email?: string; avatar_uri?: string }) =>
    request<User>('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  uploadAvatar: (base64Image: string) =>
    request<{ avatar_uri: string }>('/api/users/avatar', {
      method: 'POST',
      body: JSON.stringify({ image: base64Image }),
    }),
  registerPushToken: (token: string, platform?: string) =>
    request<{ success: boolean }>('/api/users/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),
  deleteAccount: () =>
    request<{ success: boolean }>('/api/users/me', { method: 'DELETE' }),
};

// ── Posts ────────────────────────────────────────────────
export const postsApi = {
  nearby: (lat: number, lng: number, radiusKm = 15, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius_km: String(radiusKm),
      ...params,
    });
    return request<Post[]>(`/api/posts/nearby?${qs}`);
  },
  get: (id: string) => request<Post>(`/api/posts/${id}`),
  mine: () => request<Post[]>('/api/posts/my/list'),
  history: () => request<Post[]>('/api/posts/history/list'),
  create: (data: {
    title: string;
    description?: string;
    category: string;
    lat: number;
    lng: number;
    address_text?: string;
    event_at: string;
    duration_minutes: number;
    cost_per_person?: number;
    max_people: number;
    privacy_type?: string;
  }) =>
    request<Post>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Join Requests ────────────────────────────────────────
export const requestsApi = {
  send: (postId: string) =>
    request<{ success: boolean }>(`/api/posts/${postId}/request`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  forPost: (postId: string) =>
    request<JoinRequest[]>(`/api/posts/${postId}/requests`),
  myRequest: (postId: string) =>
    request<JoinRequest | null>(`/api/posts/${postId}/my-request`),
  approve: (postId: string, userId: string) =>
    request<{ success: boolean }>(`/api/posts/${postId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
  reject: (postId: string, userId: string) =>
    request<{ success: boolean }>(`/api/posts/${postId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),
};

// ── Chats ────────────────────────────────────────────────
export const chatsApi = {
  mine: () => request<GroupChat[]>('/api/chats/groups'),
  messages: (groupId: string) =>
    request<Message[]>(`/api/chats/groups/${groupId}/messages`),
  send: (groupId: string, body: string) =>
    request<Message>(`/api/chats/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
};
