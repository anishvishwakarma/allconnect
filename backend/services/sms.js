/**
 * SMS for OTP. Uses Twilio when TWILIO_* env vars are set; otherwise logs to console (dev).
 */

async function sendOtpSms(mobile, code) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE;

  if (sid && token && from) {
    try {
      const twilio = require('twilio');
      const client = twilio(sid, token);
      await client.messages.create({
        body: `Your AllConnect verification code: ${code}. Valid for 10 minutes.`,
        from,
        to: mobile,
      });
      return;
    } catch (err) {
      console.error('[SMS] Twilio error:', err.message);
      throw err;
    }
  }

  console.log('[SMS] (no Twilio env) OTP for', mobile, '→', code);
}

module.exports = { sendOtpSms };
