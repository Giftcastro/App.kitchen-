/**
 * The unread-message count behind the Profile tab badge and the Messages row.
 * A tiny module store rather than AppState, so a new count re-renders only
 * the two places that show it, not the whole app.
 */
import { useSyncExternalStore } from 'react';
import { getUnreadMessageCount } from '../services/promos';

let unread = 0;
const listeners = new Set<() => void>();

function set(count: number) {
  if (count === unread) return;
  unread = count;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUnreadMessages(): number {
  return useSyncExternalStore(subscribe, () => unread, () => unread);
}

/** Re-reads the count; failures (offline, migration 0012 not run yet) just leave the badge as it was. */
export async function refreshUnreadMessages(userId: string | undefined): Promise<void> {
  if (!userId) return set(0);
  try {
    set(await getUnreadMessageCount(userId));
  } catch {
    // keep the last known count
  }
}

export function clearUnreadMessages() {
  set(0);
}
