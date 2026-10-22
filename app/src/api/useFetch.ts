import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { get } from './client';

/**
 * Load something from the server, keep it fresh, and say so when it is stale.
 *
 * Reloads whenever the screen comes back into focus, and on a timer if asked
 * (the inbox polls; a guest's chat polls faster).
 */
export function useFetch<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const alive = useRef(true);
  const seq = useRef(0);

  const load = useCallback(
    async (quiet = false) => {
      if (path === null) return;
      const mine = ++seq.current;
      if (!quiet) setLoading(true);
      try {
        const next = await get<T>(path);
        if (alive.current && mine === seq.current) {
          setData(next);
          setError(null);
        }
      } catch (e) {
        if (alive.current && mine === seq.current) setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (alive.current && mine === seq.current) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(data !== null);
      if (!opts.pollMs) return;
      const id = setInterval(() => void load(true), opts.pollMs);
      return () => clearInterval(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, opts.pollMs]),
  );

  return { data, error, loading, reload: () => load(true), setData };
}
