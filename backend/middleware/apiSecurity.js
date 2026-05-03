/**
 * HTTP-level hardening for the REST API (works together with JWT auth, rate limits, parameterized SQL).
 *
 * Not a substitute for: strong JWT_SECRET, Firebase Admin verification, TLS at the host (Render),
 * database least-privilege, or a WAF for large-scale abuse.
 */

const crypto = require('crypto');

function forwardedProto(req) {
  const raw = req.headers['x-forwarded-proto'];
  if (!raw) return '';
  return String(raw).split(',')[0].trim().toLowerCase();
}

function isHttpsRequest(req) {
  if (req.secure) return true;
  return forwardedProto(req) === 'https';
}

/** Reject cleartext to the app in production (Render sets X-Forwarded-Proto). Set ENFORCE_HTTPS=false to skip. */
function enforceProductionHttps(req, res, next) {
  const skip = process.env.ENFORCE_HTTPS === '0' || process.env.ENFORCE_HTTPS === 'false';
  if (skip) return next();
  if (process.env.NODE_ENV !== 'production') return next();
  if (isHttpsRequest(req)) return next();
  return res.status(403).json({ error: 'HTTPS required' });
}

/** Baseline headers + HSTS when we know the connection is HTTPS (typical on Render). */
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (process.env.NODE_ENV === 'production' && isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * JSON APIs should not be cached by shared proxies; X-Request-Id helps correlate logs without exposing data.
 */
function apiNoCacheAndRequestId(req, res, next) {
  const path = req.originalUrl || req.url || '';
  if (!path.startsWith('/api')) return next();
  res.setHeader('Cache-Control', 'private, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Request-Id', crypto.randomBytes(8).toString('hex'));
  next();
}

module.exports = {
  enforceProductionHttps,
  securityHeaders,
  apiNoCacheAndRequestId,
  isHttpsRequest,
};
