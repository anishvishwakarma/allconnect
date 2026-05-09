/**
 * Expo Push Notifications.
 * Sends to device tokens stored in device_tokens table.
 */
const Expo = require('expo-server-sdk').Expo;
const db = require('../db');

let expo = null;
let ensuredTable = false;

function getExpo() {
  if (expo) return expo;
  expo = new Expo();
  return expo;
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

/**
 * Send push notification to a user by user_id.
 * @param {string} userId - Target user ID
 * @param {object} payload - { title, body, data? }
 */
async function sendPushToUser(userId, payload) {
  await saveInAppNotification(userId, payload);
  const rows = await db.rows(
    'SELECT token FROM device_tokens WHERE user_id = $1',
    [userId]
  );
  if (!rows?.length) return;
  const messages = rows
    .map((r) => r.token)
    .filter((t) => Expo.isExpoPushToken(t))
    .map((token) => ({
      to: token,
      title: payload.title || 'AllConnect',
      body: payload.body || '',
      data: payload.data || {},
      sound: 'default',
      priority: 'high',
    }));
  if (!messages.length) return;
  const client = getExpo();
  const chunks = client.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await client.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('Push send error:', err);
    }
  }
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
