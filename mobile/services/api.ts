import { API_URL } from '../constants/config';
import { useAuthStore } from '../store/auth';
import type { Post, JoinRequest, GroupChat, Message, User } from '../types';

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (e) {
    const msg =
      e instanceof Error &&
      (e.message === 'Failed to fetch' || e.message?.includes('Network request failed'))
        ? 'Network error. Check your connection and try again.'
        : (e instanceof Error ? e.message : 'Request failed');
    throw new Error(msg);
  }

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
    const err = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: string }).error : undefined;
    throw new Error(err || `HTTP ${res.status}`);
  }
  return data as T;
}

// ── Auth ───────────────────────────────────────────────
export const authApi = {
  // Email/password auth (Firebase) — mobile optional, required at registration
  firebaseLogin: (idToken: string, mobile?: string) =>
    request<{ token: string; user: User }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify(mobile ? { idToken, mobile } : { idToken }),
    }),
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
