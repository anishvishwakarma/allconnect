const express = require('express');
const { rateLimitHealth } = require('../middleware/rateLimiter');

const router = express.Router();

const DEFAULT_ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.allconnect.app';

const DEFAULT_UPDATE_MESSAGE = 'A new version is available. Please update.';

/**
 * GET /api/app/version?platform=android|ios
 * Tells the mobile app whether to prompt for an update (no auth).
 * Render env: APP_LATEST_VERSION, APP_MIN_VERSION_ANDROID, APP_MIN_VERSION_IOS,
 * APP_STORE_URL_ANDROID, APP_STORE_URL_IOS, APP_FORCE_UPDATE (optional).
 */
router.get('/version', rateLimitHealth, (req, res) => {
  const platform = String(req.query.platform || '').toLowerCase();
  const latest = (process.env.APP_LATEST_VERSION || '1.1.7').trim();
  const minAndroid = (process.env.APP_MIN_VERSION_ANDROID || '1.1.1').trim();
  const minIos = (process.env.APP_MIN_VERSION_IOS || '1.1.1').trim();
  const minVersion = platform === 'ios' ? minIos : minAndroid;
  const forceUpdate = process.env.APP_FORCE_UPDATE === 'true';
  const storeUrlAndroid = (process.env.APP_STORE_URL_ANDROID || DEFAULT_ANDROID_STORE).trim();
  const storeUrlIos = (process.env.APP_STORE_URL_IOS || '').trim();
  const storeUrl = platform === 'ios' ? storeUrlIos : storeUrlAndroid;

  return res.json({
    latest_version: latest,
    min_version: minVersion,
    min_version_android: minAndroid,
    min_version_ios: minIos,
    force_update: forceUpdate,
    message: (process.env.APP_UPDATE_MESSAGE || '').trim() || DEFAULT_UPDATE_MESSAGE,
    store_url: storeUrl,
    store_url_android: storeUrlAndroid,
    store_url_ios: storeUrlIos,
  });
});

module.exports = router;
