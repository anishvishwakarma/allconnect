const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

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

router.use(authMiddleware);

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    const user = await db.row('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    return res.json(userRowToJson(user));
  } catch (err) {
    console.error('users/me', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/me
router.patch('/me', async (req, res) => {
  try {
    const { name, email } = req.body || {};
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) {
      updates.push(`name = $${i++}`);
      values.push(name === '' ? null : name);
    }
    if (email !== undefined) {
      updates.push(`email = $${i++}`);
      values.push(email === '' ? null : email);
    }
    if (updates.length === 0) {
      const user = await db.row('SELECT * FROM users WHERE id = $1', [req.userId]);
      return res.json(userRowToJson(user));
    }
    updates.push('updated_at = NOW()');
    values.push(req.userId);
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i}`,
      values
    );
    const user = await db.row('SELECT * FROM users WHERE id = $1', [req.userId]);
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
    const user = await db.row('SELECT id FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('users/me delete', err);
    return res.status(500).json({ error: 'Could not delete account' });
  }
});

module.exports = router;
