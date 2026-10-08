/**
 * useProgressSync — client-side progress synchronization.
 *
 * 1. On auth change: if the user just logged in, POST the entire localStorage
 *    state to /api/progress/sync (merge on first login).
 * 2. Debounced PUT on localStorage changes: poll every 3 s; when the stored
 *    state differs from the last synced snapshot, debounce 1 s and PUT each
 *    key to /api/progress.
 * 3. Returns { synced, sync() } — `sync()` triggers a manual full re-sync.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { readAppState } from '@/lib/storage';

export interface UseProgressSyncReturn {
  /** True after the initial sync completes. */
  synced: boolean;
  /** Manually trigger a full re-sync from localStorage to the cloud. */
  sync: () => Promise<void>;
}

const POLL_INTERVAL = 3000; // 3 s
const SAVE_DEBOUNCE = 1000; // 1 s

export function useProgressSync(): UseProgressSyncReturn {
  const { data: session, status } = useSession();
  const isAuthed = status === 'authenticated' && !!session;

  const [synced, setSynced] = useState(false);
  const lastSeenRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Manual / auto sync on login ─────────────────────────────
  const sync = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const localData = readAppState();
      const res = await fetch('/api/progress/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localData }),
      });
      if (res.ok) {
        setSynced(true);
        lastSeenRef.current = JSON.stringify(localData);
      }
    } catch {
      // Network or server error — fail silently; localStorage persists.
    }
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) {
      setSynced(false);
      return;
    }
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  // ── Debounced PUT on localStorage changes ────────────────────
  useEffect(() => {
    if (!isAuthed) return;

    const poll = () => {
      const current = JSON.stringify(readAppState());
      if (current === lastSeenRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const data = readAppState();
        const payload = data as unknown as Record<string, unknown>;
        await Promise.all(
          Object.keys(payload).map((key) =>
            fetch('/api/progress', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ key, value: payload[key] }),
            }),
          ),
        );
        lastSeenRef.current = current;
      }, SAVE_DEBOUNCE);
    };

    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthed]);

  return { synced, sync };
}
