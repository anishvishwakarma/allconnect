/**
 * Swallow expo-updates fetch failures when OTA is disabled in app.config.
 * Old store builds may still have an updates URL baked in; this keeps the app usable until users upgrade.
 */
const UPDATE_ERROR =
  /failed to download remote update|java\.io\.IOException.*remote update/i;

if (typeof global !== "undefined" && global.ErrorUtils?.getGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = String(error?.message ?? error ?? "");
    if (UPDATE_ERROR.test(msg)) {
      console.warn("[AllConnect] OTA update fetch ignored:", msg);
      return;
    }
    defaultHandler(error, isFatal);
  });
}

import "expo-router/entry";
