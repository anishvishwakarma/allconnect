import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/config";
import type { AlertButton } from "../components/AppAlert";

const DISMISS_STORAGE_KEY = "allconnect_update_prompt_dismissed";

export type AppVersionPayload = {
  latest_version: string;
  min_version: string;
  min_version_android?: string;
  min_version_ios?: string;
  force_update?: boolean;
  message: string;
  store_url_android: string;
  store_url_ios: string;
};

function parseParts(v: string): number[] {
  return String(v || "0")
    .trim()
    .split(".")
    .map((n) => {
      const x = parseInt(n.replace(/[^0-9].*$/, ""), 10);
      return Number.isFinite(x) ? x : 0;
    });
}

/** True if `current` is strictly older than `required`. */
export function isVersionOlder(current: string, required: string): boolean {
  const a = parseParts(current);
  const b = parseParts(required);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a[i] ?? 0;
    const cb = b[i] ?? 0;
    if (ca < cb) return true;
    if (ca > cb) return false;
  }
  return false;
}

export function getInstalledAppVersion(): string {
  return (
    Constants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    "0.0.0"
  );
}

function storeUrlForPlatform(payload: AppVersionPayload): string | null {
  if (Platform.OS === "ios") {
    const url = (payload.store_url_ios || "").trim();
    return url || null;
  }
  const url = (payload.store_url_android || "").trim();
  return url || "https://play.google.com/store/apps/details?id=com.allconnect.app";
}

async function openStore(url: string | null) {
  if (!url) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
  } catch {
    /* ignore */
  }
}

export async function fetchAppVersionInfo(): Promise<AppVersionPayload | null> {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${API_URL}/api/app/version?platform=${platform}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as AppVersionPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type ShowAlert = (
  title: string,
  message: string,
  buttons?: AlertButton[],
  type?: "info" | "success" | "error"
) => void;

export async function maybePromptAppUpdate(show: ShowAlert): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  if (Constants.appOwnership === "expo") return;

  const payload = await fetchAppVersionInfo();
  if (!payload) return;

  const current = getInstalledAppVersion();
  const minRequired = (payload.min_version || payload.latest_version || "").trim();
  const latest = (payload.latest_version || minRequired).trim();
  if (!minRequired && !latest) return;

  const belowMin = minRequired && isVersionOlder(current, minRequired);
  const belowLatest = latest && isVersionOlder(current, latest);
  if (!belowMin && !belowLatest) return;

  const force = Boolean(payload.force_update) || belowMin;
  const storeUrl = storeUrlForPlatform(payload);
  const title = force ? "Update required" : "Update available";
  const message =
    payload.message ||
    (force
      ? `AllConnect ${latest} is required. You are on ${current}.`
      : `AllConnect ${latest} is available. You are on ${current}.`);

  if (!force) {
    const dismissed = await AsyncStorage.getItem(DISMISS_STORAGE_KEY);
    if (dismissed === latest) return;
  }

  const updateBtn: AlertButton = {
    text: "Update now",
    onPress: () => {
      void openStore(storeUrl);
    },
  };

  if (force) {
    show(title, message, storeUrl ? [updateBtn] : [{ text: "OK" }], "info");
    return;
  }

  show(
    title,
    message,
    [
      {
        text: "Later",
        style: "cancel",
        onPress: () => {
          void AsyncStorage.setItem(DISMISS_STORAGE_KEY, latest);
        },
      },
      ...(storeUrl ? [updateBtn] : []),
    ],
    "info"
  );
}
