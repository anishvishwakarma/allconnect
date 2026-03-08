const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { uploadAvatar } = require('../services/storage');
const { verifyIdToken, deleteUser } = require('../services/firebase');

const router = express.Router();

function userRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    mobile: r.mobile,
    name: r.name,
    email: r.email,
    avatar_uri: r.avatar_uri,
    kyc_verified: r.kyc_verified || false,
    posts_this_month: r.posts_this_month ?? 0,
    subscription_ends_at: r.subscription_ends_at,
  };
}

async function getUserForResponse(userId) {
  return db.row(
    `SELECT u.*,
            (
              SELECT COUNT(*)::int
              FROM posts p
              WHERE p.host_id = u.id
                AND p.created_at >= date_trunc('month', NOW())
                AND p.created_at < date_trunc('month', NOW()) + interval '1 month'
            ) AS posts_this_month
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );
}

function isExpoPushToken(token) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

router.use(authMiddleware);

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    const user = await getUserForResponse(req.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.json(userRowToJson(user));
  } catch (err) {
    console.error('users/me', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/avatar — upload avatar image (base64), returns { avatar_uri }
router.post('/avatar', async (req, res) => {
  try {
    const image = req.body?.image;
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image (base64) required' });
    }
    const SAFE_AVATAR_MESSAGES = ['Image too large', 'Upload failed', 'Storage not configured', 'bucket', 'set up'];
    let url;
    try {
      url = await uploadAvatar(req.userId, image);
    } catch (err) {
      const msg = err && typeof err.message === 'string' ? err.message : '';
      const safe = SAFE_AVATAR_MESSAGES.some((s) => msg.includes(s)) ? msg : 'Upload failed';
      return res.status(400).json({ error: safe });
    }
    if (!url) {
      return res.status(503).json({ error: 'Storage not configured' });
    }
    await db.query(
      'UPDATE users SET avatar_uri = $1, updated_at = NOW() WHERE id = $2',
      [url, req.userId]
    );
    return res.json({ avatar_uri: url });
  } catch (err) {
    console.error('users/avatar', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/push-token — register Expo push token
router.post('/push-token', async (req, res) => {
  try {
    const token = (req.body?.token || '').trim();
    const platform = (req.body?.platform || 'unknown').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    if (!isExpoPushToken(token)) return res.status(400).json({ error: 'invalid push token' });
    await db.query(
      'DELETE FROM device_tokens WHERE token = $1 AND user_id != $2',
      [token, req.userId]
    );
    await db.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, token) DO UPDATE SET platform = $3, created_at = NOW()`,
      [req.userId, token, platform]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('users/push-token', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/push-token — unregister Expo push token
router.delete('/push-token', async (req, res) => {
  try {
    const token = (req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    await db.query('DELETE FROM device_tokens WHERE user_id = $1 AND token = $2', [req.userId, token]);
    return res.json({ success: true });
  } catch (err) {
    console.error('users/push-token delete', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me
router.patch('/me', async (req, res) => {
  try {
    const { name, avatar_uri } = req.body || {};
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(name === '' ? null : name);
    }
    if (avatar_uri !== undefined) {
      updates.push(`avatar_uri = $${i++}`);
      values.push(avatar_uri === '' ? null : avatar_uri);
    }
    if (updates.length === 0) {
      const user = await getUserForResponse(req.userId);
      return res.json(userRowToJson(user));
    }
    updates.push('updated_at = NOW()');
    values.push(req.userId);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );
    const user = await getUserForResponse(req.userId);
    return res.json(userRowToJson(user));
  } catch (err) {
    console.error('users/me patch', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/me — Delete account and all associated data (Play/App Store requirement)
router.delete('/me', async (req, res) => {
  try {
    const userId = req.userId;
    const user = await db.row('SELECT id, firebase_uid FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const firebaseIdToken = (req.body?.firebase_id_token || '').trim();
    if (!firebaseIdToken) {
      return res.status(400).json({ error: 'firebase_id_token required' });
    }
    const decoded = await verifyIdToken(firebaseIdToken);
    if (!decoded?.uid) {
      return res.status(401).json({ error: 'Re-authentication required before account deletion' });
    }
    if (!user.firebase_uid || user.firebase_uid !== decoded.uid) {
      return res.status(403).json({ error: 'This token does not match the signed-in account' });
    }
    const deletedFromFirebase = await deleteUser(decoded.uid);
    if (!deletedFromFirebase) {
      return res.status(503).json({ error: 'Could not delete authentication account right now' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('users/me delete', err);
    return res.status(500).json({ error: 'Could not delete account' });
  }
});

module.exports = router;
