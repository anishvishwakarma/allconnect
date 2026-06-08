const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { rateLimitChatMessage } = require('../middleware/rateLimiter');

const router = express.Router();

let ensuredLastReadColumn = false;
async function ensureLastReadColumn() {
  if (ensuredLastReadColumn) return;
  await db.query(
    'ALTER TABLE group_chat_members ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ'
  );
  ensuredLastReadColumn = true;
}

function groupRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    post_id: r.post_id,
    title: r.title,
    category: r.category,
    event_at: r.event_at,
    expires_at: r.expires_at,
    unread_count: r.unread_count != null ? Number(r.unread_count) : 0,
  };
}

function messageRowToJson(r, { includeProfile = false } = {}) {
  if (!r) return null;
  const out = {
    id: r.id,
    user_id: r.user_id,
    user_name: r.user_name || null,
    body: r.body,
    created_at: r.created_at,
  };
  if (includeProfile) {
    out.user_avatar_uri = r.user_avatar_uri || null;
  }
  return out;
}

function memberRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name || null,
    avatar_uri: r.avatar_uri || null,
  };
}

// GET /api/chats/groups
router.get('/groups', authMiddleware, async (req, res) => {
  try {
    await ensureLastReadColumn();
    const rows = await db.rows(
      `SELECT gc.*,
        (
          SELECT COUNT(*)::int FROM messages m
          WHERE m.group_chat_id = gc.id
            AND m.user_id <> $1
            AND (gcm.last_read_at IS NULL OR m.created_at > gcm.last_read_at)
        ) AS unread_count
       FROM group_chats gc
       INNER JOIN group_chat_members gcm ON gcm.group_chat_id = gc.id AND gcm.user_id = $1
       ORDER BY
         CASE WHEN gc.expires_at > NOW() THEN 0 ELSE 1 END ASC,
         gc.event_at DESC`,
      [req.userId]
    );
    return res.json(rows.map(groupRowToJson));
  } catch (err) {
    console.error('chats/groups', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chats/groups/:groupId/members — profiles visible only while chat is live
router.get('/groups/:groupId/members', authMiddleware, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const member = await db.row(
      'SELECT 1 FROM group_chat_members WHERE group_chat_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this chat' });
    const group = await db.row('SELECT expires_at FROM group_chats WHERE id = $1', [groupId]);
    if (!group) return res.status(404).json({ error: 'Chat not found' });
    const expired = new Date(group.expires_at) < new Date();
    if (expired) {
      return res.json({ expired: true, members: [] });
    }
    const rows = await db.rows(
      `SELECT u.id, u.name, u.avatar_uri
       FROM group_chat_members gcm
       INNER JOIN users u ON u.id = gcm.user_id
       WHERE gcm.group_chat_id = $1
       ORDER BY (u.id = (
         SELECT host_id FROM posts p
         INNER JOIN group_chats gc ON gc.post_id = p.id
         WHERE gc.id = $1
         LIMIT 1
       )) DESC, u.name ASC NULLS LAST, u.id ASC`,
      [groupId]
    );
    return res.json({ expired: false, members: rows.map(memberRowToJson) });
  } catch (err) {
    console.error('chats/members', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/chats/groups/:groupId/messages (allowed when chat expired — read-only)
router.get('/groups/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    await ensureLastReadColumn();
    const groupId = req.params.groupId;
    const member = await db.row(
      'SELECT 1 FROM group_chat_members WHERE group_chat_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    if (!member) return res.status(403).json({ error: 'Not a member of this chat' });
    const group = await db.row('SELECT expires_at FROM group_chats WHERE id = $1', [groupId]);
    if (!group) return res.status(404).json({ error: 'Chat not found' });
    // Allow loading messages for expired chats so users can read history (POST still blocks sending)
    const expired = new Date(group.expires_at) < new Date();
    const rows = await db.rows(
      `SELECT m.*, u.name AS user_name, u.avatar_uri AS user_avatar_uri
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.group_chat_id = $1
       ORDER BY m.created_at ASC`,
      [groupId]
    );
    await db.query(
      'UPDATE group_chat_members SET last_read_at = NOW() WHERE group_chat_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );
    return res.json({
      messages: rows.map((r) => messageRowToJson(r, { includeProfile: !expired })),
      expired,
    });
  } catch (err) {
    console.error('chats/messages', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/chats/groups/:groupId/messages
router.post('/groups/:groupId/messages', authMiddleware, rateLimitChatMessage, async (req, res) => {
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
    const msg = await db.row(
      `SELECT m.*, u.name AS user_name, u.avatar_uri AS user_avatar_uri
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.id = $1`,
      [id]
    );
    const msgJson = messageRowToJson(msg, { includeProfile: true });
    req.app.emit('chat:new_message', { groupId, message: msgJson });
    return res.json(msgJson);
  } catch (err) {
    console.error('chats/send', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
