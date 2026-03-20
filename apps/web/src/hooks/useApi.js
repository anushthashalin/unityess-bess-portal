import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data-fetching hook.
 * @param {Function} fetcher  — an async function that returns { data: [...] }
 * @param {Array}    deps     — re-fetch when these change (default: once on mount)
 */
export function useApi(fetcher, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      setData(res.data ?? res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}

/**
 * Fetch multiple endpoints in parallel.
 * @param {Object} fetcherMap  — { key: asyncFn }
 * @param {Array}  deps        — re-fetch when these change (default: once on mount)
 */
export function useApiMulti(fetcherMap, deps = []) {
  const keys = Object.keys(fetcherMap);
  const [state, setState] = useState(
    Object.fromEntries(keys.map(k => [k, { data: null, loading: true, error: null }]))
  );

  const load = useCallback(() => {
    // Reset to loading
    setState(Object.fromEntries(keys.map(k => [k, { data: null, loading: true, error: null }])));
    Promise.all(
      keys.map(k =>
        fetcherMap[k]()
          .then(res => ({ key: k, data: res.data ?? res, error: null }))
          .catch(e  => ({ key: k, data: null, error: e.message }))
      )
    ).then(results => {
      setState(
        Object.fromEntries(
          results.map(r => [r.key, { data: r.data, loading: false, error: r.error }])
        )
      );
    });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const loading = keys.some(k => state[k].loading);
  const error   = keys.map(k => state[k].error).find(Boolean) ?? null;
  return { ...state, loading, error, refetch: load };
}
