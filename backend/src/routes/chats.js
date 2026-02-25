import { Router } from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/groups', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.id, g.post_id, g.expires_at, p.title, p.category, p.event_at
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       JOIN posts p ON p.id = g.post_id
       WHERE gm.user_id = $1 AND g.expires_at > NOW()
       ORDER BY g.expires_at ASC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

router.get('/groups/:id/messages', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { rows: member } = await query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.userId]
    );
    if (member.length === 0) return res.status(403).json({ error: 'Not a member' });
    const { rows } = await query(
      `SELECT cm.id, cm.user_id, cm.body, cm.created_at FROM chat_messages cm WHERE cm.group_id = $1 ORDER BY cm.created_at ASC`,
      [groupId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/groups/:id/messages', async (req, res) => {
  try {
    const groupId = req.params.id;
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });
    const { rows: member } = await query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, req.userId]
    );
    if (member.length === 0) return res.status(403).json({ error: 'Not a member' });
    const { rows } = await query(
      `INSERT INTO chat_messages (group_id, user_id, body) VALUES ($1, $2, $3) RETURNING id, user_id, body, created_at`,
      [groupId, req.userId, body.trim()]
    );
    const msg = rows[0];
    const io = req.app.get('io');
    if (io) io.to(`group:${groupId}`).emit('new_message', msg);
    res.status(201).json(msg);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
