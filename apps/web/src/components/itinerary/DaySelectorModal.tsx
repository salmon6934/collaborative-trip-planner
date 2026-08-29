'use client';

import { formatDayLabel } from '@/lib/format';

interface DayOption {
  id: string;
  dayNumber: number;
  date: string;
}

interface DaySelectorModalProps {
  title: string;
  description?: string;
  days: DayOption[];
  onSelect: (dayId: string) => void;
  onClose: () => void;
}

/**
 * A compact modal that lets the user pick a target day.
 * Used for "Copy to Day…" (duplicate) and bulk "Move to Day…".
 */
export function DaySelectorModal({ title, description, days, onSelect, onClose }: DaySelectorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {days.map((day) => (
            <button
              key={day.id}
              onClick={() => onSelect(day.id)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50"
            >
              <span className="font-medium text-gray-900">Day {day.dayNumber}</span>
              <span className="text-xs text-gray-500">{formatDayLabel(day.date)}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
