'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { DayColumn } from './DayColumn';
import { AddActivityModal } from './AddActivityModal';
import type { BlockData } from './SortableBlock';
import { useSocket, ConnectionStatus } from '../../hooks/useSocket';
import { useTripSync } from '../../hooks/useTripSync';

interface DayData {
  id: string;
  tripId: string;
  date: string;
  dayNumber: number;
  blocks: BlockData[];
}

export function ItineraryBoard() {
  const { data: session } = useSession();
  const params = useParams();
  const tripId = params.id as string;
  const token = (session as any)?.accessToken as string | undefined;

  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModalDayId, setAddModalDayId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch days via REST (initial load + resync on reconnect)
  const fetchDays = useCallback(async () => {
    if (!token) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch itinerary');

      const data = await res.json();
      setDays(data.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  useEffect(() => {
    fetchDays();
  }, [fetchDays]);

  // Socket connection with auto-reconnect + resync
  const { socket, status } = useSocket({
    tripId,
    token,
    onReconnect: fetchDays, // Resync state after reconnection
  });

  // Real-time block sync + mutation functions
  const { createBlock, updateBlock, moveBlock, deleteBlock } = useTripSync({
    socket,
    days,
    setDays,
  });

  function findDayContainingBlock(blockId: string): DayData | undefined {
    return days.find((day) => day.blocks.some((b) => b.id === blockId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !token) return;

    const activeBlockId = active.id as string;
    const overId = over.id as string;

    const sourceDay = findDayContainingBlock(activeBlockId);
    if (!sourceDay) return;

    // Determine the target day: either the block's day or the droppable day itself
    let targetDay = findDayContainingBlock(overId);
    if (!targetDay) {
      // The over element is a day column (droppable), not a block
      targetDay = days.find((d) => d.id === overId);
    }
    if (!targetDay) return;

    if (sourceDay.id === targetDay.id) {
      // Reorder within the same day
      const oldIndex = sourceDay.blocks.findIndex((b) => b.id === activeBlockId);
      const newIndex = sourceDay.blocks.findIndex((b) => b.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const newBlocks = arrayMove(sourceDay.blocks, oldIndex, newIndex);

      // Optimistic update for reorder
      setDays((prev) =>
        prev.map((d) => (d.id === sourceDay.id ? { ...d, blocks: newBlocks } : d))
      );

      // Use socket to emit move for the dragged block to its new position
      const targetPosition = newIndex + 1;
      const result = await moveBlock(activeBlockId, sourceDay.id, targetPosition);
      if (!result.ok) {
        // Revert on failure by re-fetching
        fetchDays();
      }
    } else {
      // Move to a different day
      const block = sourceDay.blocks.find((b) => b.id === activeBlockId);
      if (!block) return;

      // Determine target position
      const overBlockIndex = targetDay.blocks.findIndex((b) => b.id === overId);
      const targetPosition = overBlockIndex >= 0 ? overBlockIndex + 1 : targetDay.blocks.length + 1;

      const result = await moveBlock(activeBlockId, targetDay.id, targetPosition);
      if (!result.ok) {
        fetchDays();
      }
    }
  }

  async function handleDeleteBlock(blockId: string) {
    await deleteBlock(blockId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-gray-500">
          No days found for this trip. Days are created automatically when you set your trip dates.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Connection status indicator */}
      {status === 'reconnecting' && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700">
          <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          Reconnecting...
        </div>
      )}
      {status === 'disconnected' && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Disconnected — changes may not sync
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {days.map((day) => (
            <DayColumn
              key={day.id}
              dayId={day.id}
              dayNumber={day.dayNumber}
              date={day.date}
              blocks={day.blocks}
              onAddActivity={(dayId) => setAddModalDayId(dayId)}
              onDeleteBlock={handleDeleteBlock}
            />
          ))}
        </div>
      </DndContext>

      {/* Add Activity Modal — now uses socket-based createBlock */}
      {addModalDayId && token && (
        <AddActivityModal
          dayId={addModalDayId}
          tripId={tripId}
          token={token}
          onClose={() => setAddModalDayId(null)}
          onCreated={() => {
            setAddModalDayId(null);
          }}
          createBlock={createBlock}
        />
      )}
    </>
  );
}
