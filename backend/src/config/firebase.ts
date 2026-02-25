import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let initialized = false;

export function initFirebase(): void {
  if (initialized) return;

  // Option A: JSON string in env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized (from env JSON)');
    return;
  }

  // Option B: path to JSON file
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Firebase service account file not found: ${filePath}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('✅ Firebase Admin initialized (from file)');
    return;
  }

  console.warn(
    '⚠️ Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH. Auth will fail until configured.'
  );
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  if (!initialized || !admin.apps.length) {
    throw new Error('Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
  }
  return admin.auth().verifyIdToken(idToken);
}

export async function getFirebaseUser(uid: string): Promise<admin.auth.UserRecord> {
  if (!initialized || !admin.apps.length) {
    throw new Error('Firebase not configured.');
  }
  return admin.auth().getUser(uid);
}

export default admin;
