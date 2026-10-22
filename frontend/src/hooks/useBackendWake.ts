import { useEffect, useState } from 'react';
import { getBackendOrigin } from '../lib/api';

/**
 * Free hosting (Render) sleeps after 15 minutes idle and takes ~30-60 s to wake.
 * Pings the DB-free liveness endpoint and reports progress so the UI can explain the wait.
 */
export function useBackendWake() {
  const [waking, setWaking] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    const ping = async (): Promise<boolean> => {
      const controller = new AbortController();
      const abort = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${getBackendOrigin()}/api/v1/health`, { signal: controller.signal });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(abort);
      }
    };

    const loop = async () => {
      const ok = await ping();
      if (cancelled) return;
      if (ok) {
        setWaking(false);
        return;
      }
      setWaking(true);
      setSeconds(Math.round((Date.now() - started) / 1000));
      timer = setTimeout(loop, 3000);
    };
    void loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { waking, seconds };
}
