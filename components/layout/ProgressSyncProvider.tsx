'use client';

import { useProgressSync } from '@/lib/hooks/useProgressSync';

/**
 * Activates background syncing of localStorage → cloud on auth change.
 * Rendered inside <SessionProvider> in root layout so `useSession` works.
 */
export function ProgressSyncProvider() {
  useProgressSync();
  return null;
}
