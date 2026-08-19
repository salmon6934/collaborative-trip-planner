'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableBlock, BlockData } from './SortableBlock';

interface DayColumnProps {
  dayId: string;
  dayNumber: number;
  date: string;
  blocks: BlockData[];
  onAddActivity: (dayId: string) => void;
  onDeleteBlock: (blockId: string) => void;
}

export function DayColumn({ dayId, dayNumber, date, blocks, onAddActivity, onDeleteBlock }: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId });

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-gray-200 bg-gray-50">
      {/* Day header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 rounded-t-xl">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Day {dayNumber}</h3>
          <p className="text-xs text-gray-500">{formattedDate}</p>
        </div>
        <button
          onClick={() => onAddActivity(dayId)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label={`Add activity to day ${dayNumber}`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Droppable area with blocks */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition ${
          isOver ? 'bg-indigo-50' : ''
        }`}
        style={{ minHeight: '200px' }}
      >
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              onDelete={onDeleteBlock}
            />
          ))}
        </SortableContext>

        {blocks.length === 0 && !isOver && (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-gray-400">
              Drop activities here or click + to add
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
