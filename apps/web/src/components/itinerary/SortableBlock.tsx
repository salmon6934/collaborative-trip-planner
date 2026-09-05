'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ActivityCategory } from '@tripsync/shared';
import { formatTime, formatRelativeTime, formatAbsoluteDate, isWithinHours } from '@/lib/format';

export interface BlockData {
  id: string;
  dayId: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  estimatedCost: number | null;
  currency: string;
  position: number;
  createdBy: string;
  lastEditedBy: string | null;
  updatedAt: string;
  createdAt?: string;
}

export interface MemberInfo {
  name: string;
  avatarUrl: string | null;
}

const categoryColors: Record<ActivityCategory, { bg: string; text: string; border: string }> = {
  food: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300' },
  travel: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  stay: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
  activity: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
};

const avatarColors = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-violet-500', 'bg-fuchsia-500', 'bg-teal-500',
];
function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

interface SortableBlockProps {
  block: BlockData;
  canEdit: boolean;
  members: Map<string, MemberInfo>;
  tzAbbrev: string | null;
  /** Name of another user currently editing this block, or null. */
  lockedByName: string | null;
  expanded: boolean;
  onToggleExpand: (blockId: string) => void;
  onEdit: (block: BlockData) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (block: BlockData) => void;
  /** Greyed out because it doesn't match the active search/filter. */
  dimmed: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (blockId: string) => void;
}

function MiniAvatar({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl: string | null }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white ${avatarColor(userId)}`}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function SortableBlock({
  block,
  canEdit,
  members,
  tzAbbrev,
  lockedByName,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  dimmed,
  selectMode,
  selected,
  onToggleSelect,
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const colors = categoryColors[block.category];
  const creator = members.get(block.createdBy);
  const editor = block.lastEditedBy ? members.get(block.lastEditedBy) : undefined;
  const recentlyEdited =
    block.lastEditedBy && block.updatedAt && isWithinHours(block.updatedAt, 24);

  const actionsDisabled = !!lockedByName;

  function handleCardClick() {
    if (selectMode) {
      onToggleSelect(block.id);
    } else {
      onToggleExpand(block.id);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      // Stable DOM id so other views (e.g. the map's "Go to Itinerary" link)
      // can deep-link straight to this card.
      id={`block-${block.id}`}
      className={`scroll-mt-24 rounded-lg border-l-4 ${colors.border} bg-white p-3 shadow-sm transition ${
        isDragging ? 'opacity-50 shadow-lg' : 'hover:shadow-md'
      } ${dimmed ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-indigo-400' : ''} ${
        lockedByName ? 'ring-1 ring-amber-300' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Select checkbox (select mode) */}
        {selectMode && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(block.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            aria-label={`Select ${block.title}`}
          />
        )}

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

        {/* Body (clickable to expand) */}
        <div className="min-w-0 flex-1 cursor-pointer" onClick={handleCardClick}>
          <p className="text-sm font-medium text-gray-900 truncate">{block.title}</p>

          {(block.startTime || block.endTime) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {block.startTime && formatTime(block.startTime, tzAbbrev)}
              {block.startTime && block.endTime && ' — '}
              {block.endTime && formatTime(block.endTime, tzAbbrev)}
            </p>
          )}

          {block.locationName && (
            <p className="mt-0.5 text-xs text-gray-500 truncate">📍 {block.locationName}</p>
          )}

          {/* Footer: category + cost */}
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
              {block.category}
            </span>
            {block.estimatedCost != null && block.estimatedCost > 0 && (
              <span className="text-xs text-gray-500">
                {block.currency} {block.estimatedCost.toLocaleString()}
              </span>
            )}
          </div>

          {/* "Who added this" attribution */}
          {creator && (
            <div
              className="mt-2 flex items-center gap-1 text-[11px] text-gray-400"
              title={`Added by ${creator.name}${block.createdAt ? ` on ${formatAbsoluteDate(block.createdAt)}` : ''}`}
            >
              <MiniAvatar userId={block.createdBy} name={creator.name} avatarUrl={creator.avatarUrl} />
              <span className="truncate">Added by {creator.name}</span>
            </div>
          )}

          {/* Last edited timestamp (within 24h) */}
          {recentlyEdited && (
            <p className="mt-0.5 text-[11px] text-gray-400">
              edited {formatRelativeTime(block.updatedAt)}
              {editor ? ` by ${editor.name}` : ''}
            </p>
          )}

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3" onClick={(e) => e.stopPropagation()}>
              {block.description ? (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Notes</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-600">{block.description}</p>
                </div>
              ) : (
                <p className="text-xs italic text-gray-400">No description or notes yet.</p>
              )}

              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Estimated cost</p>
                <p className="mt-0.5 text-xs text-gray-600">
                  {block.estimatedCost != null && block.estimatedCost > 0
                    ? `${block.currency} ${block.estimatedCost.toLocaleString()}`
                    : 'Not set'}
                </p>
              </div>

              {block.latitude != null && block.longitude != null && (
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Coordinates</p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {block.latitude.toFixed(4)}, {block.longitude.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons (owners/editors only) */}
        {canEdit && !selectMode && (
          <div className="flex flex-shrink-0 flex-col items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!actionsDisabled) onEdit(block);
              }}
              disabled={actionsDisabled}
              title={actionsDisabled ? `${lockedByName} is editing this` : 'Edit'}
              className="rounded p-1 text-gray-300 transition hover:bg-indigo-50 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label={`Edit ${block.title}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(block);
              }}
              title="Copy to day…"
              className="rounded p-1 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={`Duplicate ${block.title}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!actionsDisabled) onDelete(block.id);
              }}
              disabled={actionsDisabled}
              title={actionsDisabled ? `${lockedByName} is editing this` : 'Delete'}
              className="rounded p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label={`Delete ${block.title}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Editing lock banner */}
      {lockedByName && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {lockedByName} is editing…
        </p>
      )}
    </div>
  );
}
