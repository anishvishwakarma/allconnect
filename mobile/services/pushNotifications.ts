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

type NotificationsModule = typeof import('expo-notifications');

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
  if (isExpoGo()) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const Device = await import('expo-device');
  if (!Device.isDevice) return null;

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
  if (finalStatus !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return token;
}

export async function registerPushTokenWithBackend(): Promise<void> {
  if (isExpoGo()) return;
  const token = await registerForPushNotificationsAsync();
  if (!token) return;
  try {
    await usersApi.registerPushToken(token, Platform.OS);
    await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, token);
  } catch {
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
