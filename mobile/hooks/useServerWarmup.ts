import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { isServerAlwaysOn, warmupServer } from '../services/serverWarmup';

/** Ping /health on cold start and whenever the app returns to foreground. Non-blocking. */
export function useServerWarmup() {
  const lastWarmupRef = useRef(0);
  const MIN_GAP_MS = 30_000;

  function pingIfDue() {
    if (isServerAlwaysOn()) return;
    const now = Date.now();
    if (now - lastWarmupRef.current < MIN_GAP_MS) return;
    lastWarmupRef.current = now;
    warmupServer();
  }

  useEffect(() => {
    // Start waking Render as soon as the app shell mounts (before login / tabs).
    pingIfDue();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') pingIfDue();
    });

    return () => sub.remove();
  }, []);
}
