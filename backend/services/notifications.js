/**
 * Expo Push Notifications.
 * Sends to device tokens stored in device_tokens table.
 */
const Expo = require('expo-server-sdk').Expo;
const db = require('../db');

let expo = null;

function getExpo() {
  if (expo) return expo;
  expo = new Expo();
  return expo;
}

/**
 * Send push notification to a user by user_id.
 * @param {string} userId - Target user ID
 * @param {object} payload - { title, body, data? }
 */
async function sendPushToUser(userId, payload) {
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

module.exports = { sendPushToUser, sendPushToUsers };
