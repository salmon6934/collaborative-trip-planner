'use client';

/**
 * Checkbox list that toggles map pin visibility per trip day. Doubles as the
 * map legend: each row shows the day's pin color and how many pins it has.
 */

export interface DayFilterEntry {
  dayNumber: number;
  color: string;
  pinCount: number;
}

export interface DayFilterProps {
  days: DayFilterEntry[];
  /** Day numbers currently shown on the map. */
  visibleDays: Set<number>;
  onToggleDay: (dayNumber: number) => void;
  onShowAll: () => void;
  onShowNone: () => void;
}

export function DayFilter({
  days,
  visibleDays,
  onToggleDay,
  onShowAll,
  onShowNone,
}: DayFilterProps) {
  if (days.length === 0) return null;

  const allVisible = days.every((d) => visibleDays.has(d.dayNumber));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Days</h3>
        <button
          type="button"
          onClick={allVisible ? onShowNone : onShowAll}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          {allVisible ? 'Hide all' : 'Show all'}
        </button>
      </div>

      <ul className="space-y-1.5">
        {days.map((day) => {
          const checked = visibleDays.has(day.dayNumber);
          return (
            <li key={day.dayNumber}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleDay(day.dayNumber)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-white"
                  style={{ backgroundColor: day.color }}
                  aria-hidden="true"
                />
                <span className="flex-1">Day {day.dayNumber}</span>
                <span className="text-xs text-gray-400">
                  {day.pinCount} {day.pinCount === 1 ? 'pin' : 'pins'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DayFilter;
