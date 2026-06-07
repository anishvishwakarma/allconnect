/**
 * Must run before expo-router loads. `import` is hoisted, so use require() after setup.
 * Swallows expo-updates / dev-client "Failed to download remote update" when OTA is off.
 */
const UPDATE_ERROR =
  /failed to download remote update|failed,?\s*expo|java\.io\.IOException|remote update/i;

if (typeof global !== "undefined" && global.ErrorUtils?.getGlobalHandler) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    const msg = String(error?.message ?? error ?? "");
    if (UPDATE_ERROR.test(msg)) {
      console.warn("[AllConnect] Update fetch ignored (OTA disabled):", msg);
      return;
    }
    defaultHandler(error, isFatal);
  });
}

try {
  const { LogBox } = require("react-native");
  LogBox.ignoreLogs([
    /expo-notifications.*Expo Go/i,
    /expo-notifications.*SDK 53/i,
    /Android Push notifications \(remote notifications\)/i,
  ]);
} catch (_) {}

require("expo-router/entry");
