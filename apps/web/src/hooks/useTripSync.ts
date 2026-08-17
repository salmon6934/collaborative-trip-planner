'use client';

import { useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { BlockData } from '../components/itinerary/SortableBlock';
import { useOptimisticUpdate } from './useOptimisticUpdate';

interface DayData {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  blocks: BlockData[];
}

interface UseTripSyncOptions {
  socket: Socket | null;
  days: DayData[];
  setDays: React.Dispatch<React.SetStateAction<DayData[]>>;
}

/**
 * Listens to real-time block events from the server and merges them into local state.
 * Provides mutation functions that emit socket events with acknowledgement callbacks
 * and apply optimistic updates.
 */
export function useTripSync({ socket, days, setDays }: UseTripSyncOptions) {
  const { applyOptimistic } = useOptimisticUpdate(setDays);

  // Listen for server broadcast events
  useEffect(() => {
    if (!socket) return;

    function handleBlockCreated({ block, userId }: { block: BlockData; userId: string }) {
      setDays((prev) =>
        prev.map((day) => {
          if (day.id === block.dayId) {
            // Avoid duplicates
            if (day.blocks.some((b) => b.id === block.id)) return day;
            return { ...day, blocks: [...day.blocks, block] };
          }
          return day;
        }),
      );
    }

    function handleBlockUpdated({ block, userId }: { block: BlockData; userId: string }) {
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          blocks: day.blocks.map((b) => (b.id === block.id ? block : b)),
        })),
      );
    }

    function handleBlockMoved({ block, userId }: { block: BlockData; userId: string }) {
      setDays((prev) =>
        prev.map((day) => {
          if (day.id === block.dayId) {
            // Add to target day if not already there
            if (day.blocks.some((b) => b.id === block.id)) {
              return { ...day, blocks: day.blocks.map((b) => (b.id === block.id ? block : b)) };
            }
            return { ...day, blocks: [...day.blocks, block].sort((a, b) => a.position - b.position) };
          }
          // Remove from other days
          return { ...day, blocks: day.blocks.filter((b) => b.id !== block.id) };
        }),
      );
    }

    function handleBlockDeleted({ blockId, userId }: { blockId: string; userId: string }) {
      setDays((prev) =>
        prev.map((day) => ({
          ...day,
          blocks: day.blocks.filter((b) => b.id !== blockId),
        })),
      );
    }

    socket.on('block:created', handleBlockCreated);
    socket.on('block:updated', handleBlockUpdated);
    socket.on('block:moved', handleBlockMoved);
    socket.on('block:deleted', handleBlockDeleted);

    return () => {
      socket.off('block:created', handleBlockCreated);
      socket.off('block:updated', handleBlockUpdated);
      socket.off('block:moved', handleBlockMoved);
      socket.off('block:deleted', handleBlockDeleted);
    };
  }, [socket, setDays]);

  // --- Mutation functions ---

  /**
   * Emits a socket event with acknowledgement and returns a promise.
   */
  function emitWithAck(
    event: string,
    data: unknown,
  ): Promise<{ ok?: boolean; error?: string; block?: BlockData }> {
    return new Promise((resolve) => {
      if (!socket || !socket.connected) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit(event, data, (response: any) => {
        resolve(response);
      });
    });
  }

  const createBlock = useCallback(
    async (input: {
      dayId: string;
      title: string;
      category: string;
      startTime?: string;
      endTime?: string;
      locationName?: string;
      estimatedCost?: number;
    }): Promise<{ ok: boolean; error?: string }> => {
      // Generate a temporary ID for the optimistic block
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimisticBlock: BlockData = {
        id: tempId,
        dayId: input.dayId,
        title: input.title,
        category: input.category as BlockData['category'],
        startTime: input.startTime || null,
        endTime: input.endTime || null,
        locationName: input.locationName || null,
        estimatedCost: input.estimatedCost ?? null,
        currency: 'INR',
        position: Date.now(), // Will be corrected by server
      };

      return applyOptimistic(
        (prev) =>
          prev.map((day) =>
            day.id === input.dayId ? { ...day, blocks: [...day.blocks, optimisticBlock] } : day,
          ),
        async () => {
          const response = await emitWithAck('block:create', input);
          if (response.ok && response.block) {
            // Replace temp block with the real one from server
            setDays((prev) =>
              prev.map((day) => ({
                ...day,
                blocks: day.blocks.map((b) => (b.id === tempId ? response.block! : b)),
              })),
            );
          }
          return response;
        },
      );
    },
    [socket, applyOptimistic, setDays],
  );

  const updateBlock = useCallback(
    async (
      blockId: string,
      updates: Partial<Omit<BlockData, 'id' | 'dayId' | 'position'>>,
    ): Promise<{ ok: boolean; error?: string }> => {
      return applyOptimistic(
        (prev) =>
          prev.map((day) => ({
            ...day,
            blocks: day.blocks.map((b) => (b.id === blockId ? { ...b, ...updates } : b)),
          })),
        () => emitWithAck('block:update', { blockId, ...updates }),
      );
    },
    [socket, applyOptimistic],
  );

  const moveBlock = useCallback(
    async (
      blockId: string,
      targetDayId: string,
      targetPosition: number,
    ): Promise<{ ok: boolean; error?: string }> => {
      return applyOptimistic(
        (prev) => {
          let movedBlock: BlockData | undefined;
          const withoutBlock = prev.map((day) => {
            const block = day.blocks.find((b) => b.id === blockId);
            if (block) movedBlock = { ...block, dayId: targetDayId, position: targetPosition };
            return { ...day, blocks: day.blocks.filter((b) => b.id !== blockId) };
          });

          if (!movedBlock) return prev;

          return withoutBlock.map((day) => {
            if (day.id === targetDayId) {
              const newBlocks = [...day.blocks];
              newBlocks.splice(targetPosition - 1, 0, movedBlock!);
              return { ...day, blocks: newBlocks };
            }
            return day;
          });
        },
        () => emitWithAck('block:move', { blockId, targetDayId, targetPosition }),
      );
    },
    [socket, applyOptimistic],
  );

  const deleteBlock = useCallback(
    async (blockId: string): Promise<{ ok: boolean; error?: string }> => {
      return applyOptimistic(
        (prev) =>
          prev.map((day) => ({
            ...day,
            blocks: day.blocks.filter((b) => b.id !== blockId),
          })),
        () => emitWithAck('block:delete', { blockId }),
      );
    },
    [socket, applyOptimistic],
  );

  return { createBlock, updateBlock, moveBlock, deleteBlock };
}
