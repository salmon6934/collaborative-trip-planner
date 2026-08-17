'use client';

import { useRef, useCallback } from 'react';

/**
 * Provides an optimistic update mechanism: applies a change immediately to local state,
 * then reverts if the server rejects the operation.
 *
 * Usage:
 *   const { applyOptimistic } = useOptimisticUpdate(setDays);
 *   applyOptimistic(
 *     (prev) => applyChange(prev),  // optimistic updater
 *     () => serverEmit(data),        // server action returning a promise
 *   );
 */
export function useOptimisticUpdate<T>(setState: React.Dispatch<React.SetStateAction<T>>) {
  const snapshotRef = useRef<T | null>(null);

  const applyOptimistic = useCallback(
    async (
      optimisticUpdater: (prev: T) => T,
      serverAction: () => Promise<{ ok?: boolean; error?: string }>,
    ): Promise<{ ok: boolean; error?: string }> => {
      // Capture snapshot before applying optimistic change
      let snapshot: T | undefined;
      setState((prev) => {
        snapshot = prev;
        snapshotRef.current = prev;
        return optimisticUpdater(prev);
      });

      try {
        const response = await serverAction();

        if (!response.ok) {
          // Revert to snapshot
          if (snapshotRef.current !== null) {
            setState(snapshotRef.current);
          }
          return { ok: false, error: response.error };
        }

        return { ok: true };
      } catch (err) {
        // Revert on network failure
        if (snapshotRef.current !== null) {
          setState(snapshotRef.current);
        }
        return { ok: false, error: 'Network error' };
      }
    },
    [setState],
  );

  return { applyOptimistic };
}
