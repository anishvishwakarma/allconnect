const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken } = require('../middleware/auth');
const { sendOtpSms } = require('../services/sms');
const { rateLimitOtp, rateLimitOtpVerify } = require('../middleware/rateLimitOtp');
const { rateLimitAuth } = require('../middleware/rateLimitAuth');
const { verifyIdToken, isConfigured } = require('../services/firebase');

const router = express.Router();
const OTP_TTL_MINUTES = 10;
const INDIA_MOBILE_LENGTH = 10;
const OTP_SECRET = process.env.OTP_SECRET || process.env.JWT_SECRET;
if (!OTP_SECRET) {
  throw new Error('OTP_SECRET (or JWT_SECRET) must be set before starting the server');
}

function normalizeMobile(mobile) {
  const digits = (mobile || '').replace(/\D/g, '');
  if (digits.length >= INDIA_MOBILE_LENGTH) {
    return '+91' + digits.slice(-INDIA_MOBILE_LENGTH);
  }
  return null;
}

function hashOtp(mobile, code) {
  return crypto.createHash('sha256').update(`${mobile}:${code}:${OTP_SECRET}`).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '';
  const [name, domain] = email.split('@');
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}

async function getUserForResponse(userId) {
  return db.row(
    `SELECT u.*,
            (
              SELECT COUNT(*)::int
              FROM posts p
              WHERE p.host_id = u.id
                AND p.created_at >= date_trunc('month', NOW())
                AND p.created_at < date_trunc('month', NOW()) + interval '1 month'
            ) AS posts_this_month
     FROM users u
     WHERE u.id = $1`,
    [userId]
  );
}

function userRowToJson(r) {
  if (!r) return null;
  return {
    id: r.id,
    mobile: r.mobile,
    name: r.name,
    email: r.email,
    avatar_uri: r.avatar_uri,
    kyc_verified: r.kyc_verified || false,
    posts_this_month: r.posts_this_month ?? 0,
    subscription_ends_at: r.subscription_ends_at,
  };
}

// POST /api/auth/send-otp (rate limited: 5 per mobile per 15 min)
router.post('/send-otp', rateLimitOtp, async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    if (!mobile) {
      return res.status(400).json({ error: 'Invalid mobile number' });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await db.query(
      `INSERT INTO otp_codes (mobile, code, expires_at) VALUES ($1, $2, $3)
       ON CONFLICT (mobile) DO UPDATE SET code = $2, expires_at = $3`,
      [mobile, hashOtp(mobile, code), expiresAt]
    );
    await sendOtpSms(mobile, code);
    return res.json({ success: true });
  } catch (err) {
    console.error('send-otp', err);
    return res.status(500).json({ error: 'Could not send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', rateLimitOtpVerify, async (req, res) => {
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const code = (req.body?.code || '').trim();
    if (!mobile || code.length !== 6) {
      return res.status(400).json({ error: 'Invalid mobile or code' });
    }
    const row = await db.row(
      'SELECT code, expires_at FROM otp_codes WHERE mobile = $1',
      [mobile]
    );
    if (!row || row.expires_at < new Date()) {
      return res.status(401).json({ error: 'OTP expired or invalid' });
    }
    if (!safeEqual(row.code, hashOtp(mobile, code))) {
      return res.status(401).json({ error: 'Incorrect OTP' });
    }
    await db.query('DELETE FROM otp_codes WHERE mobile = $1', [mobile]);

    let user = await db.row('SELECT * FROM users WHERE mobile = $1', [mobile]);
    if (!user) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO users (id, mobile, name, email, avatar_uri, kyc_verified, posts_this_month, subscription_ends_at)
         VALUES ($1, $2, NULL, NULL, NULL, FALSE, 0, NULL)`,
        [id, mobile]
      );
      user = await getUserForResponse(id);
    }
    const token = signToken({ userId: user.id });
    return res.json({ token, user: userRowToJson(user) });
  } catch (err) {
    console.error('verify-otp', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /api/auth/email-for-login?mobile= — get email for login-by-mobile (rate limited)
router.get('/email-for-login', rateLimitAuth, async (req, res) => {
  try {
    const mobile = normalizeMobile(req.query?.mobile);
    if (!mobile) return res.status(400).json({ error: 'Valid mobile required' });
    const user = await db.row('SELECT email FROM users WHERE mobile = $1 AND email IS NOT NULL', [mobile]);
    if (!user || !user.email) return res.status(404).json({ error: 'No account found for this mobile' });
    return res.json({ email: maskEmail(user.email) });
  } catch (err) {
    console.error('email-for-login', err);
    return res.status(500).json({ error: 'Could not lookup account' });
  }
});

// POST /api/auth/firebase — verify Firebase ID token, return our JWT (email+password auth)
// For registration: send mobile in body to store with email (both required at signup)
router.post('/firebase', rateLimitAuth, async (req, res) => {
  try {
    const idToken = (req.body?.idToken || req.body?.id_token || '').trim();
    const mobile = normalizeMobile(req.body?.mobile);
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    if (!isConfigured()) {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
    const decoded = await verifyIdToken(idToken);
    if (!decoded || !decoded.email || !decoded.uid) return res.status(401).json({ error: 'Invalid or expired token' });

    const email = decoded.email.toLowerCase();
    const name = decoded.name || decoded.displayName || null;
    const mobilePlaceholder = 'email:' + email;
    const firebaseUid = decoded.uid;

    let user = await db.row(
      'SELECT * FROM users WHERE firebase_uid = $1 OR email = $2 OR mobile = $3',
      [firebaseUid, email, mobilePlaceholder]
    );
    if (!user) {
      // New user — mobile is required at registration (sent from client)
      const storeMobile = mobile || mobilePlaceholder;
      if (!mobile) {
        return res.status(400).json({ error: 'Mobile number required at registration' });
      }
      // Check mobile not already used
      const existing = await db.row('SELECT id FROM users WHERE mobile = $1', [storeMobile]);
      if (existing) return res.status(400).json({ error: 'Mobile number already in use' });
      const id = uuidv4();
      await db.query(
        `INSERT INTO users (id, mobile, name, email, firebase_uid, avatar_uri, kyc_verified, posts_this_month, subscription_ends_at)
         VALUES ($1, $2, $3, $4, $5, NULL, FALSE, 0, NULL)`,
        [id, storeMobile, name, email, firebaseUid]
      );
      user = await getUserForResponse(id);
    } else {
      const updates = [];
      const values = [];
      let i = 1;
      if (mobile && user.mobile === mobilePlaceholder) {
        const existing = await db.row('SELECT id FROM users WHERE mobile = $1', [mobile]);
        if (existing && existing.id !== user.id) return res.status(400).json({ error: 'Mobile number already in use' });
        updates.push(`mobile = $${i++}`);
        values.push(mobile);
      }
      if (!user.email) {
        updates.push(`email = $${i++}`);
        values.push(email);
      }
      if (!user.firebase_uid) {
        updates.push(`firebase_uid = $${i++}`);
        values.push(firebaseUid);
      }
      updates.push(`name = COALESCE(name, $${i++})`);
      values.push(name);
      if (updates.length) {
        values.push(user.id);
        await db.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${i}`, values);
      }
      user = await getUserForResponse(user.id);
    }

    const token = signToken({ userId: user.id });
    return res.json({ token, user: userRowToJson(user) });
  } catch (err) {
    console.error('auth/firebase', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
