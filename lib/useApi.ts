'use client';

import React from 'react';
import { api, ApiError } from '@/lib/api';

/**
 * Minimal data-fetching hook.
 *
 * Deliberately not SWR or React Query: this dashboard's needs are a request, a
 * loading state and a retry, and a cache layer would be one more thing to reason
 * about for no benefit at this size. Swap it later if list invalidation gets
 * complicated.
 *
 * There is no shop to select. Every request is answered for the signed-in
 * shop, which the backend works out from the session; nothing here can name a
 * different one.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(Boolean(path));
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        // A response that arrives after the filters changed would overwrite
        // newer data, so late results from a stale request are dropped.
        if (!cancelled) setData(result);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : 'Unable to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
