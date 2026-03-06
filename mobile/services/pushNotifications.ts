/**
 * Expo Push Notifications — register device token with backend.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { usersApi } from './api';
import { API_URL } from '../constants/config';

const PUSH_TOKEN_CACHE_KEY = 'allconnect:push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
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
