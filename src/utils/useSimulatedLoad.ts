import { useEffect, useRef, useState } from 'react';

const INITIAL_LOAD_MS = 400;
const REFRESH_MS = 500;

/**
 * Stands in for a real network fetch. Menu data now comes from Supabase (see
 * KitchenCoContext's own `menusLoading`) — `onRefresh`, when passed, is the
 * real awaited API call this hook's own comment anticipated; the timeout
 * here just keeps the shimmer up for a perceptible minimum duration on top
 * of it so a fast response doesn't flash the skeleton for one frame.
 */
export function useSimulatedLoad(onRefresh?: () => Promise<void>) {
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
    const minDuration = new Promise<void>(resolve => setTimeout(resolve, REFRESH_MS));
    Promise.all([onRefresh?.() ?? Promise.resolve(), minDuration]).finally(() => {
      if (mounted.current) setRefreshing(false);
    });
  };

  return { isLoading, refreshing, refresh };
}
