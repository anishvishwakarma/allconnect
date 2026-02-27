const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendPushToUser } = require('../services/notifications');

const router = express.Router({ mergeParams: true });

function requestRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    status: r.status,
    created_at: r.created_at,
  };
}

// POST /api/posts/:postId/request
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await db.row('SELECT id, host_id FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.host_id === req.userId) {
      return res.status(400).json({ error: 'Host cannot request to join own post' });
    }
    await db.query(
      `INSERT INTO join_requests (id, post_id, user_id, status) VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (post_id, user_id) DO NOTHING`,
      [uuidv4(), postId, req.userId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('request send', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/:postId/requests (host only)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await db.row('SELECT host_id FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const rows = await db.rows(
      'SELECT * FROM join_requests WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
    return res.json(rows.map(requestRowToJson));
  } catch (err) {
    console.error('requests list', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/:postId/my-request (auth)
router.get('/my-request', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const row = await db.row(
      'SELECT * FROM join_requests WHERE post_id = $1 AND user_id = $2',
      [postId, req.userId]
    );
    return res.json(row ? requestRowToJson(row) : null);
  } catch (err) {
    console.error('my-request', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

async function ensureGroupChatForPost(postId) {
  let gc = await db.row('SELECT * FROM group_chats WHERE post_id = $1', [postId]);
  if (gc) return gc;
  const post = await db.row('SELECT * FROM posts WHERE id = $1', [postId]);
  if (!post) return null;
  const id = uuidv4();
  const expiresAt = new Date(new Date(post.event_at).getTime() + (post.duration_minutes || 60) * 60 * 1000);
  await db.query(
    `INSERT INTO group_chats (id, post_id, title, category, event_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, postId, post.title, post.category, post.event_at, expiresAt]
  );
  await db.query(
    'INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [id, post.host_id]
  );
  gc = await db.row('SELECT * FROM group_chats WHERE id = $1', [id]);
  return gc;
}

// POST /api/posts/:postId/approve
router.post('/approve', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const post = await db.row('SELECT host_id FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    const reqRow = await db.row(
      'SELECT * FROM join_requests WHERE post_id = $1 AND user_id = $2',
      [postId, userId]
    );
    if (!reqRow || reqRow.status !== 'pending') {
      return res.status(400).json({ error: 'Request not found or already processed' });
    }
    await db.query(
      "UPDATE join_requests SET status = 'approved' WHERE post_id = $1 AND user_id = $2",
      [postId, userId]
    );
    const gc = await ensureGroupChatForPost(postId);
    if (gc) {
      await db.query(
        `INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2)
         ON CONFLICT (group_chat_id, user_id) DO NOTHING`,
        [gc.id, post.host_id]
      );
      await db.query(
        `INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2)
         ON CONFLICT (group_chat_id, user_id) DO NOTHING`,
        [gc.id, userId]
      );
      await db.query(
        `INSERT INTO post_participations (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [postId, userId]
      );
      sendPushToUser(userId, {
        title: 'Request approved',
        body: 'Your join request was approved! Open the post to join the group chat.',
        data: { type: 'join_approved', postId },
      }).catch((e) => console.error('Push on approve:', e));
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('approve', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts/:postId/reject
router.post('/reject', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const post = await db.row('SELECT host_id FROM posts WHERE id = $1', [postId]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.host_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
    await db.query(
      "UPDATE join_requests SET status = 'rejected' WHERE post_id = $1 AND user_id = $2",
      [postId, userId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error('reject', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
