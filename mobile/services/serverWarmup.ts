import { API_URL, isServerAlwaysOnEnv } from '../constants/config';

/** Set when /health reports always_on (paid Render). */
let detectedAlwaysOn: boolean | null = null;

/** True when Render is paid/always-on — skip cold-start pings and wake-up copy. */
export function isServerAlwaysOn(): boolean {
  if (isServerAlwaysOnEnv()) return true;
  return detectedAlwaysOn === true;
}

/** Ping health in the background — no-op on paid Render. Helps wake free tier. */
export function warmupServer(timeoutMs = 12000): void {
  if (isServerAlwaysOn()) return;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  fetch(`${API_URL}/health`, { method: 'GET', signal: ctrl.signal })
    .then(async (res) => {
      if (!res.ok) return;
      try {
        const data = (await res.json()) as { always_on?: boolean };
        if (data?.always_on === true) detectedAlwaysOn = true;
      } catch {
        // ignore parse errors
      }
    })
    .catch(() => {})
    .finally(() => clearTimeout(t));
}

export type ConnectingKind = 'server' | 'email';

export function getConnectingMessage(
  elapsedMs: number,
  kind: ConnectingKind = 'server'
): { title: string; subtitle: string } {
  if (kind === 'email') {
    return { title: 'Sending reset link…', subtitle: 'Please wait a moment.' };
  }
  if (isServerAlwaysOn()) {
    return { title: 'Connecting…', subtitle: 'Please wait a moment.' };
  }
  if (elapsedMs < 1500) {
    return { title: 'Connecting…', subtitle: 'Please wait a moment.' };
  }
  if (elapsedMs < 6000) {
    return { title: 'Connecting to server…', subtitle: 'This may take a few seconds.' };
  }
  if (elapsedMs < 18000) {
    return { title: 'Server is waking up…', subtitle: 'First load after idle can take up to a minute.' };
  }
  return { title: 'Almost there…', subtitle: 'Still connecting — please don\'t close the app.' };
}
