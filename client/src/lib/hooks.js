import { useCallback, useEffect, useRef, useState } from 'react';

/** GET a JSON endpoint from the API with loading + error state. */
export function useApi(path, { deps = [], poll = 0, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const alive = useRef(true);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(
    async (silent = false) => {
      if (!enabled || !pathRef.current) return;
      if (!silent) setLoading(true);
      try {
        const res = await fetch(pathRef.current);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Failed (${res.status})`);
        if (alive.current) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (alive.current) setError(e);
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps]
  );

  useEffect(() => {
    alive.current = true;
    load();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    if (!poll || !enabled) return undefined;
    const t = setInterval(() => load(true), poll);
    return () => clearInterval(t);
  }, [poll, enabled, load]);

  return { data, error, loading, reload: load, setData };
}

/** Run an async action with busy state + toast error reporting. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}

export function useInterval(callback, delay) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delay == null) return undefined;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
