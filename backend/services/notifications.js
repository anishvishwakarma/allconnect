/**
 * Expo Push Notifications.
 * Sends to device tokens stored in device_tokens table.
 */
const Expo = require('expo-server-sdk').Expo;
const db = require('../db');
const { getAdmin } = require('./firebase');

let expo = null;
let ensuredTable = false;

function getExpo() {
  if (expo) return expo;
  expo = new Expo();
  return expo;
}

async function removeDeviceToken(token) {
  if (!token) return;
  try {
    await db.query('DELETE FROM device_tokens WHERE token = $1', [token]);
  } catch (err) {
    console.error('Push token cleanup error:', err);
  }
}

async function removeFcmDeviceToken(token) {
  if (!token) return;
  try {
    await db.query('DELETE FROM fcm_device_tokens WHERE token = $1', [token]);
  } catch (err) {
    console.error('FCM token cleanup error:', err);
  }
}

function fcmData(data) {
  const out = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value == null) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}

async function ensureNotificationsTable() {
  if (ensuredTable) return;
  await db.query(
    `CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  );
  await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL');
  await db.query(
    `CREATE TABLE IF NOT EXISTS fcm_device_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      platform TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, token)
    )`
  );
  await db.query('CREATE INDEX IF NOT EXISTS idx_fcm_device_tokens_user ON fcm_device_tokens(user_id)');
  await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_fcm_device_tokens_token ON fcm_device_tokens(token)');
  ensuredTable = true;
}

async function saveInAppNotification(userId, payload) {
  if (!userId) return;
  try {
    await ensureNotificationsTable();
    await db.query(
      `INSERT INTO notifications (user_id, title, body, data)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        userId,
        payload.title || 'AllConnect',
        payload.body || '',
        JSON.stringify(payload.data || {}),
      ]
    );
  } catch (err) {
    console.error('Notification save error:', err);
  }
}

async function sendFirebasePushToUser(userId, payload) {
  const admin = getAdmin();
  if (!admin) return;
  await ensureNotificationsTable();
  const rows = await db.rows(
    'SELECT token FROM fcm_device_tokens WHERE user_id = $1',
    [userId]
  );
  const tokens = (rows || []).map((r) => r.token).filter(Boolean);
  if (!tokens.length) return;

  const message = {
    tokens,
    notification: {
      title: payload.title || 'AllConnect',
      body: payload.body || '',
    },
    data: fcmData(payload.data || {}),
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
  };

  try {
    const messaging = admin.messaging();
    const response =
      typeof messaging.sendEachForMulticast === 'function'
        ? await messaging.sendEachForMulticast(message)
        : await messaging.sendMulticast(message);
    (response.responses || []).forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code || '';
      console.error('FCM send error:', {
        tokenTail: tokens[index] ? tokens[index].slice(-12) : '',
        code,
        message: result.error?.message,
      });
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        void removeFcmDeviceToken(tokens[index]);
      }
    });
  } catch (err) {
    console.error('FCM multicast send error:', err);
  }
}

/**
 * Send push notification to a user by user_id.
 * @param {string} userId - Target user ID
 * @param {object} payload - { title, body, data? }
 */
async function sendPushToUser(userId, payload) {
  await saveInAppNotification(userId, payload);
  await ensureNotificationsTable();
  const rows = await db.rows(
    'SELECT token FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  const messages = rows
    .map((r) => r.token)
    .filter((t) => Expo.isExpoPushToken(t))
    .map((token) => ({
      to: token,
      title: payload.title || 'AllConnect',
      body: payload.body || '',
      data: payload.data || {},
      sound: 'default',
      channelId: 'default',
      priority: 'high',
    }));
  if (messages.length) {
    const client = getExpo();
    const chunks = client.chunkPushNotifications(messages);
    const receiptTokenById = new Map();
    for (const chunk of chunks) {
      try {
        const tickets = await client.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, index) => {
          const target = chunk[index]?.to;
          if (ticket.status === 'ok' && ticket.id) {
            receiptTokenById.set(ticket.id, target);
            return;
          }
          if (ticket.status === 'error') {
            console.error('Push ticket error:', {
              tokenTail: typeof target === 'string' ? target.slice(-12) : '',
              message: ticket.message,
              details: ticket.details,
            });
            if (ticket.details?.error === 'DeviceNotRegistered') {
              void removeDeviceToken(target);
            }
          }
        });
      } catch (err) {
        console.error('Push send error:', err);
      }
    }
    const receiptIds = Array.from(receiptTokenById.keys());
    if (receiptIds.length) {
      const receiptChunks = client.chunkPushNotificationReceiptIds(receiptIds);
      for (const receiptChunk of receiptChunks) {
        try {
          const receipts = await client.getPushNotificationReceiptsAsync(receiptChunk);
          for (const [receiptId, receipt] of Object.entries(receipts)) {
            if (receipt.status !== 'error') continue;
            const token = receiptTokenById.get(receiptId);
            console.error('Push receipt error:', {
              tokenTail: typeof token === 'string' ? token.slice(-12) : '',
              message: receipt.message,
              details: receipt.details,
            });
            if (receipt.details?.error === 'DeviceNotRegistered') {
              void removeDeviceToken(token);
            }
          }
        } catch (err) {
          console.error('Push receipt fetch error:', err);
        }
      }
    }
  }
  await sendFirebasePushToUser(userId, payload);
}

/**
 * Send push to multiple users (e.g. chat members except sender).
 */
async function sendPushToUsers(userIds, payload) {
  for (const uid of userIds) {
    await sendPushToUser(uid, payload);
  }
}

module.exports = { sendPushToUser, sendPushToUsers, ensureNotificationsTable };
