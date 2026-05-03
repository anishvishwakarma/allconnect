/**
 * In-memory sliding-window style rate limits (per-process).
 * Safe behind Render/nginx with trust proxy for req.ip.
 */

function clientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, keyFn }) {
  const store = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [k, e] of store.entries()) {
      if (e.windowEnd < now) store.delete(k);
    }
  }

  return function rateLimiter(req, res, next) {
    try {
      cleanup();
      const key = keyFn(req);
      if (key == null || key === '') return next();
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || entry.windowEnd < now) {
        entry = { count: 0, windowEnd: now + windowMs };
        store.set(key, entry);
      }
      entry.count += 1;
      if (entry.count > max) {
        const retryAfterSec = Math.max(1, Math.ceil((entry.windowEnd - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many requests. Try again later.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** All /api traffic per IP (broad abuse cap). */
const rateLimitApiGlobal = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  keyFn: (req) => `api-global:${clientIp(req)}`,
});

/** Public map feed — expensive DB + geo queries. */
const rateLimitPostsNearby = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 120,
  keyFn: (req) => `posts-nearby:${clientIp(req)}`,
});

/** Public post detail scraping. */
const rateLimitPostsGetById = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyFn: (req) => `posts-get:${clientIp(req)}`,
});

/** Authenticated post creation (beyond monthly quota). */
const rateLimitPostCreate = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  keyFn: (req) => `post-create:${req.userId || clientIp(req)}`,
});

/** Join request + host approve/reject (spam / abuse). */
const rateLimitRequestWrites = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyFn: (req) => `req-writes:${req.userId || clientIp(req)}`,
});

/** Chat messages per user (spam). */
const rateLimitChatMessage = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 250,
  keyFn: (req) => `chat-send:${req.userId || clientIp(req)}`,
});

/** Avatar uploads (large bodies) — abuse cap. */
const rateLimitAvatar = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 25,
  keyFn: (req) => `avatar:${req.userId || clientIp(req)}`,
});

/** Push token register/unregister churn. */
const rateLimitPushToken = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 40,
  keyFn: (req) => `push-token:${req.userId || clientIp(req)}`,
});

/** Profile PATCH (name / avatar_uri). */
const rateLimitUserProfilePatch = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyFn: (req) => `user-patch:${req.userId || clientIp(req)}`,
});

/** Account deletion — destructive, must stay rare. */
const rateLimitAccountDelete = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => `acct-del:${req.userId || clientIp(req)}`,
});

/** Places autocomplete — protects GOOGLE_PLACES quota + cost. */
const rateLimitPlacesSearch = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyFn: (req) => `places-search:${clientIp(req)}`,
});

/** Cold-start pings / monitors. */
const rateLimitHealth = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyFn: (req) => `health:${clientIp(req)}`,
});

module.exports = {
  createRateLimiter,
  clientIp,
  rateLimitApiGlobal,
  rateLimitPostsNearby,
  rateLimitPostsGetById,
  rateLimitPostCreate,
  rateLimitRequestWrites,
  rateLimitChatMessage,
  rateLimitAvatar,
  rateLimitPushToken,
  rateLimitUserProfilePatch,
  rateLimitAccountDelete,
  rateLimitPlacesSearch,
  rateLimitHealth,
};
