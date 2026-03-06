const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const VALID_PRIVACY_TYPES = new Set(['public', 'approval']);

function postRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    host_id: r.host_id,
    title: r.title,
    description: r.description,
    category: r.category,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lng),
    address_text: r.address_text,
    event_at: r.event_at,
    duration_minutes: r.duration_minutes,
    cost_per_person: r.cost_per_person != null ? parseFloat(r.cost_per_person) : null,
    max_people: r.max_people,
    status: r.status,
    privacy_type: r.privacy_type,
    created_at: r.created_at,
  };
}

// GET /api/posts/nearby?lat=&lng=&radius_km=15&category=&from=&to=
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius_km) || 15;
    const category = (req.query.category || '').trim();
    const from = (req.query.from || '').trim();
    const to = (req.query.to || '').trim();
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    const degPerKm = 1 / 111;
    const delta = radiusKm * degPerKm;
    let sql = `SELECT * FROM posts WHERE status = 'open' AND event_at > NOW()
       AND lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4`;
    const params = [lat - delta, lat + delta, lng - delta, lng + delta];
    let i = 5;
    if (category) {
      sql += ` AND category = $${i++}`;
      params.push(category);
    }
    if (from) {
      sql += ` AND event_at >= $${i++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND event_at <= $${i++}`;
      params.push(to);
    }
    sql += ' ORDER BY event_at ASC LIMIT 100';
    const rows = await db.rows(sql, params);
    return res.json(rows.map(postRowToJson));
  } catch (err) {
    console.error('posts/nearby', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/my/list (auth)
router.get('/my/list', authMiddleware, async (req, res) => {
  try {
    const rows = await db.rows(
      'SELECT * FROM posts WHERE host_id = $1 ORDER BY event_at DESC',
      [req.userId]
    );
    return res.json(rows.map(postRowToJson));
  } catch (err) {
    console.error('posts/my/list', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/history/list (auth) — posts user joined
router.get('/history/list', authMiddleware, async (req, res) => {
  try {
    const rows = await db.rows(
      `SELECT p.* FROM posts p
       INNER JOIN post_participations pp ON pp.post_id = p.id AND pp.user_id = $1
       ORDER BY p.event_at DESC LIMIT 50`,
      [req.userId]
    );
    return res.json(rows.map(postRowToJson));
  } catch (err) {
    console.error('posts/history/list', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/posts/:id
router.get('/:id', async (req, res) => {
  try {
    const post = await db.row('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(postRowToJson(post));
  } catch (err) {
    console.error('posts/get', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts (auth)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const {
      title,
      description,
      category,
      lat,
      lng,
      address_text,
      event_at,
      duration_minutes = 60,
      cost_per_person,
      max_people,
      privacy_type,
    } = body;
    if (!title || category == null || lat == null || lng == null || !event_at || max_people == null) {
      return res.status(400).json({ error: 'Missing required fields: title, category, lat, lng, event_at, max_people' });
    }
    const parsedMaxPeople = Number(max_people);
    const parsedDuration = Number(duration_minutes) || 60;
    const parsedCost = cost_per_person == null ? null : Number(cost_per_person);
    const eventDate = new Date(event_at);
    const normalizedPrivacyType = privacy_type == null || privacy_type === '' ? 'public' : String(privacy_type);
    if (!Number.isInteger(parsedMaxPeople) || parsedMaxPeople <= 0) {
      return res.status(400).json({ error: 'max_people must be a positive whole number' });
    }
    if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
      return res.status(400).json({ error: 'duration_minutes must be a positive whole number' });
    }
    if (Number.isNaN(eventDate.getTime()) || eventDate <= new Date()) {
      return res.status(400).json({ error: 'event_at must be a valid future date/time' });
    }
    if (!VALID_PRIVACY_TYPES.has(normalizedPrivacyType)) {
      return res.status(400).json({ error: 'privacy_type must be public or approval' });
    }

    const id = uuidv4();
    const client = await db.pool.connect();
    let post;
    try {
      await client.query('BEGIN');
      const userResult = await client.query(
        'SELECT posts_this_month, subscription_ends_at FROM users WHERE id = $1 FOR UPDATE',
        [req.userId]
      );
      const user = userResult.rows[0];
      if (!user) {
        await client.query('ROLLBACK');
        return res.status(401).json({ error: 'User not found' });
      }
      const hasSubscription = user.subscription_ends_at && new Date(user.subscription_ends_at) > new Date();
      const countResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM posts
         WHERE host_id = $1
           AND created_at >= date_trunc('month', NOW())
           AND created_at < date_trunc('month', NOW()) + interval '1 month'`,
        [req.userId]
      );
      const currentMonthPosts = countResult.rows[0]?.count ?? 0;
      if (!hasSubscription && currentMonthPosts >= 5) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Monthly free post limit reached' });
      }

      await client.query(
        `INSERT INTO posts (id, host_id, title, description, category, lat, lng, address_text, event_at, duration_minutes, cost_per_person, max_people, status, privacy_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'open', $13)`,
        [
          id,
          req.userId,
          title,
          description || null,
          category,
          lat,
          lng,
          address_text || null,
          event_at,
          parsedDuration,
          parsedCost,
          parsedMaxPeople,
          normalizedPrivacyType,
        ]
      );
      await client.query(
        'INSERT INTO post_participations (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, req.userId]
      );
      const postResult = await client.query('SELECT * FROM posts WHERE id = $1', [id]);
      post = postResult.rows[0];
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    return res.status(201).json(postRowToJson(post));
  } catch (err) {
    console.error('posts/create', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
