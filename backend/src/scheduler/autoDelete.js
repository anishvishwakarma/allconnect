import { query } from '../db/client.js';

const INTERVAL_MS = 60 * 1000;

async function deleteExpiredGroups() {
  try {
    const { rows } = await query(`SELECT id FROM groups WHERE expires_at <= NOW()`);
    for (const g of rows) {
      await query(`DELETE FROM groups WHERE id = $1`, [g.id]);
    }
    if (rows.length > 0) console.log(`[scheduler] Deleted ${rows.length} expired group(s)`);
  } catch (e) {
    console.error('[scheduler]', e);
  }
}

async function cleanupAuth() {
  try {
    await query(`DELETE FROM sessions WHERE expires_at < NOW()`);
    await query(`DELETE FROM otp_verifications WHERE expires_at < NOW() OR verified = true`);
  } catch (e) {
    console.error('[scheduler] cleanup:', e);
  }
}

export function initScheduler() {
  setInterval(deleteExpiredGroups, INTERVAL_MS);
  setInterval(cleanupAuth, 15 * 60 * 1000);
  deleteExpiredGroups();
  cleanupAuth();
}
