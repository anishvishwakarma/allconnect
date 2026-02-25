import { Router } from 'express';
import { query } from '../db/client.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const router = Router();
const DEV_OTP = process.env.DEV_OTP || '123456';

function generateOTP() {
  if (process.env.NODE_ENV === 'development' && DEV_OTP) return DEV_OTP;
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\+?[\d\s-]{10,}$/.test(mobile.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Valid mobile number required' });
    }
    const normalized = mobile.replace(/\s/g, '');
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await query(
      `INSERT INTO otp_verifications (mobile, code, expires_at) VALUES ($1, $2, $3)`,
      [normalized, code, expiresAt]
    );
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log(`[DEV] OTP for ${normalized}: ${code}`);
    }
    res.json({ success: true, message: 'OTP sent' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, code } = req.body;
    if (!mobile || !code) {
      return res.status(400).json({ error: 'Mobile and code required' });
    }
    const normalized = mobile.replace(/\s/g, '');
    const { rows: otpRows } = await query(
      `SELECT id FROM otp_verifications WHERE mobile = $1 AND code = $2 AND expires_at > NOW() AND NOT verified LIMIT 1`,
      [normalized, String(code).trim()]
    );
    if (otpRows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    await query(`UPDATE otp_verifications SET verified = true WHERE id = $1`, [otpRows[0].id]);

    let userId;
    const { rows: userRows } = await query(`SELECT id FROM users WHERE mobile = $1`, [normalized]);
    if (userRows.length > 0) {
      userId = userRows[0].id;
    } else {
      const { rows: insert } = await query(
        `INSERT INTO users (mobile) VALUES ($1) RETURNING id`,
        [normalized]
      );
      userId = insert[0].id;
    }

    const token = uuidv4();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    const { rows: userData } = await query(
      `SELECT u.id, u.mobile, u.email, u.name, u.kyc_verified, u.subscription_ends_at,
              (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = u.id AND date_trunc('month', p.created_at) = date_trunc('month', NOW())) AS posts_this_month
       FROM users u WHERE u.id = $1`,
      [userId]
    );
    const user = userData[0] ? {
      id: userData[0].id,
      mobile: userData[0].mobile,
      name: userData[0].name,
      email: userData[0].email,
      kyc_verified: userData[0].kyc_verified,
      posts_this_month: userData[0].posts_this_month ?? 0,
      subscription_ends_at: userData[0].subscription_ends_at,
    } : {
      id: userId,
      mobile: normalized,
      name: null,
      email: null,
      kyc_verified: false,
      posts_this_month: 0,
      subscription_ends_at: null,
    };

    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
