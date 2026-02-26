/**
 * Rate limit for auth helpers (email-for-login, etc.) - by IP
 */
const windowMs = 15 * 60 * 1000;
const maxPerWindow = 15;
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.windowEnd < now) store.delete(key);
  }
}

function rateLimitAuth(req, res, next) {
  cleanup();
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `auth:${ip}`;
  let entry = store.get(key);
  const now = Date.now();
  if (!entry || entry.windowEnd < now) {
    entry = { count: 0, windowEnd: now + windowMs };
    store.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxPerWindow) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  next();
}

module.exports = { rateLimitAuth };
