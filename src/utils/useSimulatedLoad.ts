import { useEffect, useRef, useState } from 'react';

const INITIAL_LOAD_MS = 400;
const REFRESH_MS = 500;

/**
 * Stands in for a real network fetch. All menu/order data today is local and
 * synchronous, so there's no actual latency to show — but the screens that
 * use this (Menu, Activity, Tracker) are the ones that will eventually read
 * from a real backend, and their loading/refresh UI needs to exist and be
 * exercised now rather than bolted on later. `refresh()` is the single point
 * where a real fetch would go — swap its body for an awaited API call and
 * every screen using this hook keeps working unchanged.
 */
export function useSimulatedLoad() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => {
      if (mounted.current) setIsLoading(false);
    }, INITIAL_LOAD_MS);
    return () => {
      mounted.current = false;
      clearTimeout(t);
    };
  }, []);

  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      if (mounted.current) setRefreshing(false);
    }, REFRESH_MS);
  };

  return { isLoading, refreshing, refresh };
}
