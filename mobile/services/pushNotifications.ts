/**
 * Expo Push Notifications — register device token with backend.
 * Lazy-loads expo-notifications so Expo Go (SDK 53+) never triggers push warnings on import.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isExpoGo } from '../constants/config';
import { usersApi } from './api';
import { API_URL } from '../constants/config';

const PUSH_TOKEN_CACHE_KEY = 'allconnect:push-token';
const PUSH_LAST_STATUS_KEY = 'allconnect:push-last-status';

type NotificationsModule = typeof import('expo-notifications');

type PushRegistrationStatus = {
  ok: boolean;
  stage: string;
  reason?: string;
  tokenTail?: string;
  at: string;
};

function tokenTail(token: string | null | undefined): string | undefined {
  if (!token) return undefined;
  return token.slice(-12);
}

async function savePushStatus(status: Omit<PushRegistrationStatus, 'at'>): Promise<void> {
  const payload: PushRegistrationStatus = { ...status, at: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(PUSH_LAST_STATUS_KEY, JSON.stringify(payload));
  } catch {}
  if (__DEV__ && !payload.ok) {
    console.warn('[PushNotifications]', payload.stage, payload.reason || 'failed');
  }
}

export async function getLastPushRegistrationStatus(): Promise<PushRegistrationStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_LAST_STATUS_KEY);
    return raw ? (JSON.parse(raw) as PushRegistrationStatus) : null;
  } catch {
    return null;
  }
}

async function getNotifications(): Promise<NotificationsModule | null> {
  if (isExpoGo()) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

let handlerConfigured = false;

async function ensureNotificationHandler(Notifications: NotificationsModule): Promise<void> {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo()) {
    await savePushStatus({ ok: false, stage: 'environment', reason: 'Expo Go does not support production push registration' });
    return null;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    await savePushStatus({ ok: false, stage: 'load-module', reason: 'expo-notifications could not be loaded' });
    return null;
  }

  const Device = await import('expo-device');
  if (!Device.isDevice) {
    await savePushStatus({ ok: false, stage: 'device', reason: 'Push notifications require a physical device' });
    return null;
  }

  await ensureNotificationHandler(Notifications);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8751A',
      sound: 'default',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    await savePushStatus({ ok: false, stage: 'permission', reason: `Notification permission is ${finalStatus}` });
    return null;
  }
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    await savePushStatus({ ok: false, stage: 'project-id', reason: 'Missing EAS project id' });
    return null;
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await savePushStatus({ ok: true, stage: 'token-created', tokenTail: tokenTail(token) });
    return token;
  } catch (err: any) {
    await savePushStatus({
      ok: false,
      stage: 'token-create',
      reason: err?.message || 'Could not create Expo push token',
    });
    return null;
  }
}

export async function registerPushTokenWithBackend(): Promise<void> {
  if (isExpoGo()) return;
  const token = await registerForPushNotificationsAsync();
  if (!token) return;
  try {
    await usersApi.registerPushToken(token, Platform.OS);
    await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, token);
    await savePushStatus({ ok: true, stage: 'backend-registered', tokenTail: tokenTail(token) });
  } catch {
    await savePushStatus({
      ok: false,
      stage: 'backend-register',
      reason: 'Backend rejected or could not save push token',
      tokenTail: tokenTail(token),
    });
    // Silent fail — push registration is best-effort
  }
}

export async function unregisterPushTokenWithBackend(authToken?: string | null): Promise<void> {
  if (isExpoGo()) return;
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
    if (!token) return;
    if (authToken) {
      await fetch(`${API_URL}/api/users/push-token`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
    } else {
      await usersApi.unregisterPushToken(token);
    }
    await AsyncStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
  } catch {
    // Silent fail — logout should still proceed
  }
}

export const registerForPushNotifications = registerPushTokenWithBackend;
