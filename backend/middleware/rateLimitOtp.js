/**
 * In-memory OTP throttling.
 * - send-otp: max 5 sends per mobile per 15 minutes
 * - verify-otp: max 8 attempts per (mobile + IP) per 10 minutes
 */
const sendWindowMs = 15 * 60 * 1000;
const sendMaxPerWindow = 5;
const verifyWindowMs = 10 * 60 * 1000;
const verifyMaxPerWindow = 8;
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
    entry = { count: 0, windowEnd: now + sendWindowMs };
    store.set(key, entry);
  }
  entry.count++;
  if (entry.count > sendMaxPerWindow) {
    return res.status(429).json({ error: 'Too many OTP requests. Try again in 15 minutes.' });
  }
  next();
}

function rateLimitOtpVerify(req, res, next) {
  const mobile = (req.body?.mobile || '').replace(/\D/g, '').slice(-10);
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!mobile) return next();
  cleanup();
  const key = `otp-verify:${mobile}:${ip}`;
  let entry = store.get(key);
  const now = Date.now();
  if (!entry || entry.windowEnd < now) {
    entry = { count: 0, windowEnd: now + verifyWindowMs };
    store.set(key, entry);
  }
  entry.count++;
  if (entry.count > verifyMaxPerWindow) {
    return res.status(429).json({ error: 'Too many OTP attempts. Try again later.' });
  }
  next();
}

module.exports = { rateLimitOtp, rateLimitOtpVerify };
