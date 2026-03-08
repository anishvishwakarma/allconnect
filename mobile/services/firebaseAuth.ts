/**
 * Firebase Email/Password auth.
 * Config is read from app.config.js extra (baked in at build time) so EAS builds get it from secrets.
 */
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  getAuth,
  initializeAuth,
  signOut,
  Auth,
  User,
  UserCredential,
} from 'firebase/auth';
import { PASSWORD_RESET_CONTINUE_URL } from '../constants/config';

const { getReactNativePersistence } = require('@firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
};

function getFirebaseConfig() {
  const extra = Constants.expoConfig?.extra as { firebase?: Record<string, string> } | undefined;
  const fromExtra = extra?.firebase;
  return {
    apiKey: fromExtra?.apiKey ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: fromExtra?.authDomain ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: fromExtra?.projectId ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: fromExtra?.storageBucket ?? process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: fromExtra?.messagingSenderId ?? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: fromExtra?.appId ?? process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
  };
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const config = getFirebaseConfig();
    if (!config.apiKey || config.apiKey.length < 10) {
      throw new Error(
        'Firebase API key is missing. Set EXPO_PUBLIC_FIREBASE_API_KEY in .env (local) and EAS Secrets (production), then rebuild.'
      );
    }
    app = getApps().length > 0 ? getApp() : initializeApp(config);
  }
  return app;
}

export function getFirebaseAuthInstance(): Auth {
  if (auth) return auth;
  const firebaseApp = getFirebaseApp();
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage) as never,
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  const auth = getFirebaseAuthInstance();
  const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  await sendEmailVerification(cred.user);
  return cred;
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  const auth = getFirebaseAuthInstance();
  return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
}

export async function getIdToken(user: User): Promise<string> {
  return user.getIdToken(true);
}

export function getCurrentFirebaseUser(): User | null {
  return getFirebaseAuthInstance().currentUser;
}

export async function getCurrentFirebaseIdToken(): Promise<string | null> {
  const user = getCurrentFirebaseUser();
  if (!user) return null;
  return user.getIdToken(true);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuthInstance();
  await sendPasswordResetEmail(auth, email.trim().toLowerCase(), {
    url: PASSWORD_RESET_CONTINUE_URL,
    handleCodeInApp: false,
  });
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(getFirebaseAuthInstance());
  } catch {}
}
