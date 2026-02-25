const { getDefaultConfig } = require("expo/metro-config");

// Use default Expo Metro config for reliable bundling.
// NativeWind was removed here to avoid Metro/CSS resolution issues; app uses StyleSheet.
const config = getDefaultConfig(__dirname);
// Do not enable unstable_enablePackageExports - it can cause getDevServer to resolve as Object and trigger red screen
module.exports = config;
