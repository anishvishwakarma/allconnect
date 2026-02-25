const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { signToken } = require('../middleware/auth');
const { sendOtpSms } = require('../services/sms');
const { rateLimitOtp } = require('../middleware/rateLimitOtp');
const { verifyIdToken } = require('../services/firebase');

const router = express.Router();
const OTP_TTL_MINUTES = 10;
const INDIA_MOBILE_LENGTH = 10;

function normalizeMobile(mobile) {
  const digits = (mobile || '').replace(/\D/g, '');
  if (digits.length >= INDIA_MOBILE_LENGTH) {
    return '+91' + digits.slice(-INDIA_MOBILE_LENGTH);
  }
  return null;
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
      [mobile, code, expiresAt]
    );
    await sendOtpSms(mobile, code);
    return res.json({ success: true });
  } catch (err) {
    console.error('send-otp', err);
    return res.status(500).json({ error: 'Could not send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
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
    if (row.code !== code) {
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
      user = await db.row('SELECT * FROM users WHERE id = $1', [id]);
    }
    const token = signToken({ userId: user.id });
    return res.json({ token, user: userRowToJson(user) });
  } catch (err) {
    console.error('verify-otp', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/firebase — verify Firebase ID token, return our JWT (email auth)
router.post('/firebase', async (req, res) => {
  try {
    const idToken = (req.body?.idToken || req.body?.id_token || '').trim();
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const decoded = await verifyIdToken(idToken);
    if (!decoded || !decoded.email) return res.status(401).json({ error: 'Invalid or expired token' });

    const email = decoded.email;
    const firebaseUid = decoded.uid;
    const name = decoded.name || decoded.displayName || null;

    // Use "email:user@example.com" as mobile for email users (schema requires mobile)
    const mobilePlaceholder = 'email:' + email.toLowerCase();

    let user = await db.row('SELECT * FROM users WHERE email = $1 OR mobile = $2', [email, mobilePlaceholder]);
    if (!user) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO users (id, mobile, name, email, avatar_uri, kyc_verified, posts_this_month, subscription_ends_at)
         VALUES ($1, $2, $3, $4, NULL, FALSE, 0, NULL)`,
        [id, mobilePlaceholder, name, email]
      );
      user = await db.row('SELECT * FROM users WHERE id = $1', [id]);
    } else if (!user.email) {
      await db.query('UPDATE users SET email = $1, name = COALESCE(name, $2), updated_at = NOW() WHERE id = $3', [email, name, user.id]);
      user = await db.row('SELECT * FROM users WHERE id = $1', [user.id]);
    }

    const token = signToken({ userId: user.id });
    return res.json({ token, user: userRowToJson(user) });
  } catch (err) {
    console.error('auth/firebase', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
