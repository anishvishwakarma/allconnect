const express = require('express');
const { rateLimitHealth } = require('../middleware/rateLimiter');

const router = express.Router();

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.allconnect.app';

/**
 * GET /api/app/version?platform=android|ios
 * Tells the mobile app whether to prompt for an update (no auth).
 * Configure on Render: APP_MIN_VERSION_ANDROID, APP_MIN_VERSION_IOS, APP_LATEST_VERSION, store URLs.
 */
router.get('/version', rateLimitHealth, (req, res) => {
  const platform = String(req.query.platform || '').toLowerCase();
  const latest = (process.env.APP_LATEST_VERSION || '1.1.5').trim();
  const minAndroid = (process.env.APP_MIN_VERSION_ANDROID || '1.1.1').trim();
  const minIos = (process.env.APP_MIN_VERSION_IOS || '1.1.1').trim();
  const minVersion = platform === 'ios' ? minIos : minAndroid;
  const forceUpdate = process.env.APP_FORCE_UPDATE === 'true';
  const message =
    (process.env.APP_UPDATE_MESSAGE || '').trim() ||
    'A new version of AllConnect is available. Please update to continue with the latest features and fixes.';

  return res.json({
    latest_version: latest,
    min_version: minVersion,
    min_version_android: minAndroid,
    min_version_ios: minIos,
    force_update: forceUpdate,
    message,
    store_url_android: (process.env.APP_STORE_URL_ANDROID || DEFAULT_ANDROID_STORE).trim(),
    store_url_ios: (process.env.APP_STORE_URL_IOS || '').trim(),
  });
});

module.exports = router;
