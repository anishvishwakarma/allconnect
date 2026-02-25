import { Router } from 'express';
import { query } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const FREE_POSTS_PER_MONTH = 5;

// GET /api/posts/nearby
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius_km) || 10;
    const category = req.query.category;
    const from = req.query.from;
    const to = req.query.to;
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    let sql = `
      SELECT id, user_id as host_id, title, category, description, address_text, event_at, duration_minutes,
             cost_per_person, max_people, status, created_at,
             ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
      FROM posts
      WHERE status = 'open' AND event_at > NOW()
        AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
    `;
    const params = [lng, lat, radiusKm];
    let idx = 4;
    if (category) { sql += ` AND category = $${idx++}`; params.push(category); }
    if (from) { sql += ` AND event_at >= $${idx++}`; params.push(from); }
    if (to) { sql += ` AND event_at <= $${idx++}`; params.push(to); }
    sql += ` ORDER BY event_at ASC LIMIT 100`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch nearby posts' });
  }
});

// GET /api/posts/my/list
router.get('/my/list', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, title, category, event_at, max_people, status, created_at,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
       FROM posts WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// GET /api/posts/history/list
router.get('/history/list', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.title, p.category, p.event_at, p.status, p.created_at,
              ST_X(p.location::geometry) as lng, ST_Y(p.location::geometry) as lat, 'created' as role
       FROM posts p WHERE p.user_id = $1
       UNION ALL
       SELECT p.id, p.title, p.category, p.event_at, p.status, p.created_at,
              ST_X(p.location::geometry) as lng, ST_Y(p.location::geometry) as lat, 'joined' as role
       FROM join_requests jr JOIN posts p ON p.id = jr.post_id
       WHERE jr.user_id = $1 AND jr.status = 'approved'
       ORDER BY event_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// GET /api/posts/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, user_id as host_id, title, category, description, address_text, event_at, duration_minutes,
              cost_per_person, max_people, status, privacy_type, created_at,
              ST_X(location::geometry) as lng, ST_Y(location::geometry) as lat
       FROM posts WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Post not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.use(requireAuth);

// GET /api/posts/:id/my-request — current user's join request for this post
router.get('/:id/my-request', async (req, res) => {
  try {
    const postId = req.params.id;
    const { rows } = await query(
      `SELECT id, user_id, post_id, status, created_at FROM join_requests WHERE post_id = $1 AND user_id = $2`,
      [postId, req.userId]
    );
    if (rows.length === 0) return res.json(null);
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

// POST /api/posts
router.post('/', async (req, res) => {
  try {
    const now = new Date();
    const subEnd = req.user.subscription_ends_at ? new Date(req.user.subscription_ends_at) : null;
    if (!subEnd || subEnd <= now) {
      const { rows: countRows } = await query(
        `SELECT COUNT(*) FROM posts WHERE user_id = $1 AND date_trunc('month', created_at) = date_trunc('month', NOW())`,
        [req.userId]
      );
      const n = parseInt(countRows[0].count, 10) || 0;
      if (n >= FREE_POSTS_PER_MONTH) {
        return res.status(403).json({ error: 'Post limit reached (5 per month). Subscribe for unlimited.' });
      }
    }
    const {
      title, category, description, lat, lng, address_text,
      event_at, duration_minutes, cost_per_person, max_people, privacy_type,
    } = req.body;
    if (!title || !category || lat == null || lng == null || !event_at || !max_people) {
      return res.status(400).json({ error: 'Missing required fields: title, category, lat, lng, event_at, max_people' });
    }
    if (category === 'selling' && !req.user.kyc_verified) {
      return res.status(403).json({ error: 'KYC required for selling posts.' });
    }
    const { rows } = await query(
      `INSERT INTO posts (user_id, title, category, description, location, address_text, event_at, duration_minutes, cost_per_person, max_people, privacy_type)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9, $10, $11, $12)
       RETURNING id, title, category, event_at, max_people, status, created_at`,
      [
        req.userId, title, category, description || null, parseFloat(lng), parseFloat(lat),
        address_text || null, new Date(event_at), duration_minutes || 60, cost_per_person ?? 0, max_people, privacy_type || 'public',
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// POST /api/posts/:id/request
router.post('/:id/request', async (req, res) => {
  try {
    const postId = req.params.id;
    const { rows: postRows } = await query(`SELECT id, user_id, max_people, status FROM posts WHERE id = $1`, [postId]);
    if (postRows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postRows[0];
    if (post.status !== 'open') return res.status(400).json({ error: 'Post is closed' });
    if (post.user_id === req.userId) return res.status(400).json({ error: 'Cannot request your own post' });
    const { rowCount } = await query(
      `INSERT INTO join_requests (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING`,
      [postId, req.userId]
    );
    if (rowCount === 0) return res.status(400).json({ error: 'Already requested' });
    const io = req.app.get('io');
    if (io) io.to(`post:${postId}`).emit('join_request', { postId, userId: req.userId });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Request failed' });
  }
});

// POST /api/posts/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const postId = req.params.id;
    const { user_id: applicantId } = req.body;
    if (!applicantId) return res.status(400).json({ error: 'user_id required' });
    const { rows: postRows } = await query(
      `SELECT id, user_id, max_people, event_at, duration_minutes FROM posts WHERE id = $1`,
      [postId]
    );
    if (postRows.length === 0) return res.status(404).json({ error: 'Post not found' });
    const post = postRows[0];
    if (post.user_id !== req.userId) return res.status(403).json({ error: 'Only creator can approve' });
    await query(
      `UPDATE join_requests SET status = 'approved' WHERE post_id = $1 AND user_id = $2 AND status = 'pending'`,
      [postId, applicantId]
    );
    let groupId;
    const { rows: groupRows } = await query(`SELECT id FROM groups WHERE post_id = $1`, [postId]);
    const eventEnd = new Date(new Date(post.event_at).getTime() + (post.duration_minutes || 60) * 60 * 1000);
    if (groupRows.length === 0) {
      const { rows: ins } = await query(
        `INSERT INTO groups (post_id, expires_at) VALUES ($1, $2) RETURNING id`,
        [postId, eventEnd]
      );
      groupId = ins[0].id;
      await query(`INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`, [groupId, req.userId]);
    } else {
      groupId = groupRows[0].id;
    }
    await query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, applicantId]
    );
    const { rows: count } = await query(`SELECT COUNT(*) FROM group_members WHERE group_id = $1`, [groupId]);
    if (parseInt(count[0].count, 10) >= post.max_people) {
      await query(`UPDATE posts SET status = 'closed', updated_at = NOW() WHERE id = $1`, [postId]);
    }
    const io = req.app.get('io');
    if (io) {
      io.to(`post:${postId}`).emit('join_approved', { postId, groupId, userId: applicantId });
      io.to(`group:${groupId}`).emit('member_joined', { groupId, userId: applicantId });
    }
    res.json({ success: true, groupId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Approval failed' });
  }
});

// POST /api/posts/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const postId = req.params.id;
    const { user_id: applicantId } = req.body;
    if (!applicantId) return res.status(400).json({ error: 'user_id required' });
    const { rows: postRows } = await query(`SELECT user_id FROM posts WHERE id = $1`, [postId]);
    if (postRows.length === 0) return res.status(404).json({ error: 'Post not found' });
    if (postRows[0].user_id !== req.userId) return res.status(403).json({ error: 'Only creator can reject' });
    await query(
      `UPDATE join_requests SET status = 'rejected' WHERE post_id = $1 AND user_id = $2 AND status = 'pending'`,
      [postId, applicantId]
    );
    const io = req.app.get('io');
    if (io) io.to(`post:${postId}`).emit('join_rejected', { postId, userId: applicantId });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Reject failed' });
  }
});

// GET /api/posts/:id/requests
router.get('/:id/requests', async (req, res) => {
  try {
    const postId = req.params.id;
    const { rows: postRows } = await query(`SELECT user_id FROM posts WHERE id = $1`, [postId]);
    if (postRows.length === 0) return res.status(404).json({ error: 'Post not found' });
    if (postRows[0].user_id !== req.userId) return res.status(403).json({ error: 'Not allowed' });
    const { rows } = await query(
      `SELECT jr.id, jr.user_id, jr.status, jr.created_at FROM join_requests jr WHERE jr.post_id = $1 AND jr.status = 'pending' ORDER BY jr.created_at ASC`,
      [postId]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

export default router;
