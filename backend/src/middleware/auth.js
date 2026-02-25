import crypto from 'crypto';
import { query } from '../db/client.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(
    `SELECT s.user_id, u.mobile, u.name, u.email, u.kyc_verified, u.posts_this_month, u.subscription_ends_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [tokenHash]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = rows[0];
  req.userId = rows[0].user_id;
  next();
}
