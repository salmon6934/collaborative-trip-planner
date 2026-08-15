'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ActivityCategory } from '@trip-planner/shared';

export interface BlockData {
  id: string;
  dayId: string;
  title: string;
  category: ActivityCategory;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  estimatedCost: number | null;
  currency: string;
  position: number;
}

const categoryColors: Record<ActivityCategory, { bg: string; text: string; border: string }> = {
  food: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  travel: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  stay: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  activity: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
};

function formatTime(time: string | null): string {
  if (!time) return '';
  // Handle HH:MM or HH:MM:SS format
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

export function SortableBlock({ block }: { block: BlockData }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colors = categoryColors[block.category];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border-l-4 ${colors.border} bg-white p-3 shadow-sm transition ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          className="mt-0.5 flex-shrink-0 cursor-grab touch-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          {/* Title */}
          <p className="text-sm font-medium text-gray-900 truncate">{block.title}</p>

          {/* Time range */}
          {(block.startTime || block.endTime) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {block.startTime && formatTime(block.startTime)}
              {block.startTime && block.endTime && ' — '}
              {block.endTime && formatTime(block.endTime)}
            </p>
          )}

          {/* Location */}
          {block.locationName && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">
              📍 {block.locationName}
            </p>
          )}

          {/* Footer: category badge + cost */}
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
            >
              {block.category}
            </span>
            {block.estimatedCost != null && block.estimatedCost > 0 && (
              <span className="text-xs text-gray-500">
                {block.currency} {block.estimatedCost.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
