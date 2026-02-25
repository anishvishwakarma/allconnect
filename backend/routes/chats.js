const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function groupRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    post_id: r.post_id,
    title: r.title,
    category: r.category,
    event_at: r.event_at,
    expires_at: r.expires_at,
  };
}

function messageRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    body: r.body,
    created_at: r.created_at,
  };
}

// GET /api/chats/groups
router.get('/groups', authMiddleware, async (req, res) => {
  try {
    const rows = await db.rows(
      `SELECT gc.* FROM group_chats gc
       INNER JOIN group_chat_members gcm ON gcm.group_chat_id = gc.id AND gcm.user_id = $1
       WHERE gc.expires_at > NOW()
       ORDER BY gc.expires_at ASC`,
      [req.userId]
    );
    return res.json(rows.map(groupRowToJson));
  } catch (err) {
    console.error('chats/groups', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chats/groups/:groupId/messages
router.get('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const member = await db.row(
      'SELECT 1 FROM group_chat_members WHERE group_chat_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this chat' });
    const group = await db.row('SELECT expires_at FROM group_chats WHERE id = $1', [groupId]);
    if (!group) return res.status(404).json({ error: 'Chat not found' });
    if (new Date(group.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Chat expired' });
    }
    const rows = await db.rows(
      'SELECT * FROM messages WHERE group_chat_id = $1 ORDER BY created_at ASC',
      [groupId]
    );
    return res.json(rows.map(messageRowToJson));
  } catch (err) {
    console.error('chats/messages', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chats/groups/:groupId/messages
router.post('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const body = (req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'body required' });
    const member = await db.row(
      'SELECT 1 FROM group_chat_members WHERE group_chat_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this chat' });
    const group = await db.row('SELECT expires_at FROM group_chats WHERE id = $1', [groupId]);
    if (!group) return res.status(404).json({ error: 'Chat not found' });
    if (new Date(group.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Chat expired' });
    }
    const id = uuidv4();
    await db.query(
      'INSERT INTO messages (id, group_chat_id, user_id, body) VALUES ($1, $2, $3, $4)',
      [id, groupId, req.userId, body]
    );
    const msg = await db.row('SELECT * FROM messages WHERE id = $1', [id]);
    const msgJson = messageRowToJson(msg);
    req.app.emit('chat:new_message', { groupId, message: msgJson });
    return res.json(msgJson);
  } catch (err) {
    console.error('chats/send', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
