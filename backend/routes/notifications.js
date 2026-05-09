const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function notificationRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    data: r.data || {},
    read_at: r.read_at,
    created_at: r.created_at,
  };
}

router.use(authMiddleware);

// GET /api/notifications?limit=50
router.get('/', async (req, res) => {
  try {
    const rawLimit = Number(req.query?.limit ?? 50);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
    const rows = await db.rows(
      `SELECT id, title, body, data, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.userId, limit]
    );
    const unread = await db.row(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.userId]
    );
    return res.json({
      items: rows.map(notificationRowToJson),
      unread_count: unread?.count ?? 0,
    });
  } catch (err) {
    console.error('notifications/list', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  try {
    await db.query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [req.userId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('notifications/read-all', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  try {
    const id = req.params.id;
    const row = await db.row(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, body, data, read_at, created_at`,
      [id, req.userId]
    );
    if (!row) return res.status(404).json({ error: 'Notification not found' });
    return res.json(notificationRowToJson(row));
  } catch (err) {
    console.error('notifications/read-one', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
