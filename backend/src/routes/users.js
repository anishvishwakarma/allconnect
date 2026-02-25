import { Router } from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.mobile, u.email, u.name, u.kyc_verified, u.subscription_ends_at, u.created_at,
              (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id AND date_trunc('month', p.created_at) = date_trunc('month', NOW())) AS posts_this_month
       FROM users u WHERE u.id = $1`,
      [req.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/me', async (req, res) => {
  try {
    const { name, email } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
    if (email !== undefined) { updates.push(`email = $${i++}`); values.push(email); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.userId);
    await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`,
      values
    );
    const { rows } = await query(
      `SELECT u.id, u.mobile, u.email, u.name, u.kyc_verified, u.subscription_ends_at,
              (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id AND date_trunc('month', p.created_at) = date_trunc('month', NOW())) AS posts_this_month
       FROM users u WHERE u.id = $1`,
      [req.userId]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
