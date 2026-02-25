/**
 * Firebase Email/Password auth.
 */
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
  UserCredential,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuthInstance() {
  return getAuth(getFirebaseApp());
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

export async function sendPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuthInstance();
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
