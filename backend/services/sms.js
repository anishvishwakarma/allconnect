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

  // Avoid logging OTP codes in production logs.
  // Set DEBUG_SMS=true only for local/dev troubleshooting if you fully trust the log sink.
  const debugSms = process.env.DEBUG_SMS === 'true';
  const digits = String(mobile ?? '').replace(/\D/g, '');
  const mobileTail = digits.slice(-4);
  if (debugSms) {
    console.log('[SMS] (no Twilio env) OTP for', mobileTail, '→', code);
  } else {
    console.log('[SMS] (no Twilio env) OTP generated for', mobileTail);
  }
}

module.exports = { sendOtpSms };
