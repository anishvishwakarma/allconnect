const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendPushToUser } = require('../services/notifications');
const { rateLimitRequestWrites } = require('../middleware/rateLimiter');

const router = express.Router({ mergeParams: true });

function requestRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    user_id: r.user_id,
    user_name: r.user_name || null,
    user_mobile: r.user_mobile || null,
    status: r.status,
    created_at: r.created_at,
  };
}

function isPostJoinable(post) {
  if (!post) return false;
  if (post.status && post.status !== 'open') return false;
  return new Date(post.event_at) > new Date();
}

async function ensureGroupChatForPost(client, post) {
  const expiresAt = new Date(new Date(post.event_at).getTime() + (post.duration_minutes || 60) * 60 * 1000);
  await client.query(
    `INSERT INTO group_chats (id, post_id, title, category, event_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (post_id) DO NOTHING`,
    [uuidv4(), post.id, post.title, post.category, post.event_at, expiresAt]
  );
  const gc = await client.query('SELECT * FROM group_chats WHERE post_id = $1', [post.id]);
  const groupChat = gc.rows[0] || null;
  if (groupChat) {
    await client.query(
      'INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [groupChat.id, post.host_id]
    );
  }
  return groupChat;
}

// POST /api/posts/:postId/request
router.post('/request', authMiddleware, rateLimitRequestWrites, async (req, res) => {
  try {
    const postId = req.params.postId;
    const post = await db.row(
      'SELECT id, host_id, title, category, event_at, duration_minutes, max_people, status, privacy_type FROM posts WHERE id = $1',
      [postId]
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.host_id === req.userId) {
      return res.status(400).json({ error: 'Host cannot request to join own post' });
    }
    if (!isPostJoinable(post)) {
      return res.status(400).json({ error: 'This post is no longer accepting joins' });
    }

    if (post.privacy_type === 'approval') {
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const existingResult = await client.query(
          'SELECT id, status FROM join_requests WHERE post_id = $1 AND user_id = $2 FOR UPDATE',
          [postId, req.userId]
        );
        const existing = existingResult.rows[0];

        if (!existing) {
          await client.query(
            `INSERT INTO join_requests (id, post_id, user_id, status)
             VALUES ($1, $2, $3, 'pending')`,
            [uuidv4(), postId, req.userId]
          );
          await client.query('COMMIT');
          return res.json({ success: true, status: 'pending' });
        }

        if (existing.status === 'rejected') {
          await client.query(
            "UPDATE join_requests SET status = 'pending', created_at = NOW() WHERE id = $1",
            [existing.id]
          );
          await client.query('COMMIT');
          return res.json({ success: true, status: 'pending' });
        }

        await client.query('COMMIT');
        return res.json({ success: true, status: existing.status });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const lockedPostResult = await client.query(
        'SELECT id, host_id, title, category, event_at, duration_minutes, max_people, status, privacy_type FROM posts WHERE id = $1 FOR UPDATE',
        [postId]
      );
      const lockedPost = lockedPostResult.rows[0];
      if (!isPostJoinable(lockedPost)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This post is no longer accepting joins' });
      }

      const participantsResult = await client.query(
        'SELECT COUNT(*)::int AS count FROM post_participations WHERE post_id = $1',
        [postId]
      );
      const participantCount = participantsResult.rows[0]?.count ?? 0;
      if (participantCount >= lockedPost.max_people) {
        await client.query("UPDATE posts SET status = 'full' WHERE id = $1", [postId]);
        await client.query('COMMIT');
        return res.status(409).json({ error: 'This post is already full' });
      }

      await client.query(
        `INSERT INTO join_requests (id, post_id, user_id, status)
         VALUES ($1, $2, $3, 'approved')
         ON CONFLICT (post_id, user_id) DO UPDATE SET status = 'approved'`,
        [uuidv4(), postId, req.userId]
      );
      const participationInsert = await client.query(
        `INSERT INTO post_participations (post_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [postId, req.userId]
      );
      const groupChat = await ensureGroupChatForPost(client, lockedPost);
      if (groupChat) {
        await client.query(
          `INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2)
           ON CONFLICT (group_chat_id, user_id) DO NOTHING`,
          [groupChat.id, req.userId]
        );
      }

      if (participationInsert.rowCount > 0 && participantCount + 1 >= lockedPost.max_people) {
        await client.query("UPDATE posts SET status = 'full' WHERE id = $1", [postId]);
      }

      await client.query('COMMIT');
      return res.json({ success: true, status: 'approved', group_chat_id: groupChat?.id || null });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
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
      `SELECT jr.*, u.name AS user_name, u.mobile AS user_mobile
       FROM join_requests jr
       LEFT JOIN users u ON u.id = jr.user_id
       WHERE jr.post_id = $1
       ORDER BY jr.created_at ASC`,
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

// POST /api/posts/:postId/approve
router.post('/approve', authMiddleware, rateLimitRequestWrites, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const postResult = await client.query(
        `SELECT id, host_id, title, category, event_at, duration_minutes, max_people, status, privacy_type
         FROM posts WHERE id = $1 FOR UPDATE`,
        [postId]
      );
      const post = postResult.rows[0];
      if (!post) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Post not found' });
      }
      if (post.host_id !== req.userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (post.privacy_type !== 'approval') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This post does not require approval' });
      }
      if (!isPostJoinable(post)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'This post is no longer accepting joins' });
      }

      const reqResult = await client.query(
        'SELECT * FROM join_requests WHERE post_id = $1 AND user_id = $2 FOR UPDATE',
        [postId, userId]
      );
      const reqRow = reqResult.rows[0];
      if (!reqRow || reqRow.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Request not found or already processed' });
      }

      const participantsResult = await client.query(
        'SELECT COUNT(*)::int AS count FROM post_participations WHERE post_id = $1',
        [postId]
      );
      const participantCount = participantsResult.rows[0]?.count ?? 0;
      if (participantCount >= post.max_people) {
        await client.query("UPDATE posts SET status = 'full' WHERE id = $1", [postId]);
        await client.query('COMMIT');
        return res.status(409).json({ error: 'This post is already full' });
      }

      await client.query(
        "UPDATE join_requests SET status = 'approved' WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      await client.query(
        `INSERT INTO post_participations (post_id, user_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [postId, userId]
      );
      const gc = await ensureGroupChatForPost(client, post);
      if (gc) {
        await client.query(
          `INSERT INTO group_chat_members (group_chat_id, user_id) VALUES ($1, $2)
           ON CONFLICT (group_chat_id, user_id) DO NOTHING`,
          [gc.id, userId]
        );
      }
      if (participantCount + 1 >= post.max_people) {
        await client.query("UPDATE posts SET status = 'full' WHERE id = $1", [postId]);
      }

      await client.query('COMMIT');
      sendPushToUser(userId, {
        title: 'Request approved',
        body: 'Your join request was approved! Open the post to join the group chat.',
        data: { type: 'join_approved', postId },
      }).catch((e) => console.error('Push on approve:', e));
      return res.json({ success: true, group_chat_id: gc?.id || null });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('approve', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts/:postId/reject
router.post('/reject', authMiddleware, rateLimitRequestWrites, async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: 'user_id required' });
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const postResult = await client.query('SELECT host_id FROM posts WHERE id = $1 FOR UPDATE', [postId]);
      const post = postResult.rows[0];
      if (!post) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Post not found' });
      }
      if (post.host_id !== req.userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      const reqResult = await client.query(
        'SELECT status FROM join_requests WHERE post_id = $1 AND user_id = $2 FOR UPDATE',
        [postId, userId]
      );
      const request = reqResult.rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Request not found' });
      }
      if (request.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Only pending requests can be rejected' });
      }
      await client.query(
        "UPDATE join_requests SET status = 'rejected' WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      await client.query('COMMIT');
      return res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('reject', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
