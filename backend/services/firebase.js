/**
 * Firebase Admin - verify ID tokens from mobile (Email auth)
 */
let admin = null;

function getAdmin() {
  if (admin) return admin;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (json) {
    try {
      const serviceAccount = typeof json === 'string' ? JSON.parse(json) : json;
      admin = require('firebase-admin');
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      return admin;
    } catch (e) {
      console.error('[Firebase] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      return null;
    }
  }
  if (path) {
    try {
      const fs = require('fs');
      const p = require('path');
      const fullPath = p.isAbsolute(path) ? path : p.join(process.cwd(), path);
      const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      admin = require('firebase-admin');
      if (admin.apps.length === 0) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      }
      return admin;
    } catch (e) {
      console.error('[Firebase] Failed to load service account:', e.message);
      return null;
    }
  }
  return null;
}

async function verifyIdToken(idToken) {
  const a = getAdmin();
  if (!a) return null;
  try {
    return await a.auth().verifyIdToken(idToken);
  } catch (e) {
    console.error('[Firebase] verifyIdToken:', e.message);
    return null;
  }
}

module.exports = { getAdmin, verifyIdToken };
