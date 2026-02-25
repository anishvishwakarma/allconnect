/**
 * In-memory rate limit: max 5 send-otp per mobile per 15 minutes.
 */
const windowMs = 15 * 60 * 1000;
const maxPerWindow = 5;
const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.windowEnd < now) store.delete(key);
  }
}

function rateLimitOtp(req, res, next) {
  const mobile = (req.body?.mobile || '').replace(/\D/g, '').slice(-10);
  if (!mobile) return next();
  cleanup();
  const key = `otp:${mobile}`;
  let entry = store.get(key);
  const now = Date.now();
  if (!entry || entry.windowEnd < now) {
    entry = { count: 0, windowEnd: now + windowMs };
    store.set(key, entry);
  }
  entry.count++;
  if (entry.count > maxPerWindow) {
    return res.status(429).json({ error: 'Too many OTP requests. Try again in 15 minutes.' });
  }
  next();
}

module.exports = { rateLimitOtp };
