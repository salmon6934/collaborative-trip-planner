'use client';

import { useState } from 'react';
import type { BlockData } from './SortableBlock';
import type { ActivityFormValues } from './AddActivityModal';

export interface ConflictData {
  /** The values the current user tried to save. */
  mine: ActivityFormValues;
  /** The server's current version (edited by someone else). */
  theirs: BlockData;
  /** Display name of who last edited the current version, if known. */
  theirsEditorName: string | null;
}

interface ConflictDialogProps {
  conflict: ConflictData;
  onKeepMine: () => void;
  onKeepTheirs: () => void;
  onMerge: (merged: Partial<ActivityFormValues>) => void;
  onClose: () => void;
}

type FieldKey = 'title' | 'category' | 'startTime' | 'endTime' | 'locationName' | 'estimatedCost' | 'description';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'category', label: 'Category' },
  { key: 'startTime', label: 'Start time' },
  { key: 'endTime', label: 'End time' },
  { key: 'locationName', label: 'Location' },
  { key: 'estimatedCost', label: 'Cost' },
  { key: 'description', label: 'Notes' },
];

function mineValue(mine: ActivityFormValues, key: FieldKey): string {
  const v = (mine as any)[key];
  return v === undefined || v === null || v === '' ? '—' : String(v);
}
function theirsValue(theirs: BlockData, key: FieldKey): string {
  const v = (theirs as any)[key];
  return v === undefined || v === null || v === '' ? '—' : String(v);
}

/**
 * Diff dialog shown when a save is rejected by last-write-wins.
 * Offers "Keep mine", "Keep theirs", or per-field "Merge".
 */
export function ConflictDialog({ conflict, onKeepMine, onKeepTheirs, onMerge, onClose }: ConflictDialogProps) {
  const { mine, theirs, theirsEditorName } = conflict;
  const [mergeMode, setMergeMode] = useState(false);
  // Per-field choice: true = keep mine, false = keep theirs
  const [choices, setChoices] = useState<Record<FieldKey, boolean>>(
    () => FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: true }), {} as Record<FieldKey, boolean>)
  );

  function handleMerge() {
    const merged: Partial<ActivityFormValues> = {};
    for (const f of FIELDS) {
      if (choices[f.key]) {
        (merged as any)[f.key] = (mine as any)[f.key];
      } else {
        const tv = (theirs as any)[f.key];
        (merged as any)[f.key] = tv === null ? undefined : tv;
      }
    }
    onMerge(merged);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Editing conflict</h3>
        <p className="mt-1 text-sm text-gray-600">
          This activity was changed{theirsEditorName ? ` by ${theirsEditorName}` : ' by someone else'} while you were
          editing. Choose which version to keep.
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[minmax(0,7rem)_1fr_1fr] bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
            <div className="px-3 py-2">Field</div>
            <div className="px-3 py-2">Your version</div>
            <div className="px-3 py-2">Current version{theirsEditorName ? ` (${theirsEditorName})` : ''}</div>
          </div>
          {FIELDS.map((f) => {
            const mv = mineValue(mine, f.key);
            const tv = theirsValue(theirs, f.key);
            const differs = mv !== tv;
            return (
              <div
                key={f.key}
                className={`grid grid-cols-[minmax(0,7rem)_1fr_1fr] border-t border-gray-100 text-sm ${
                  differs ? 'bg-amber-50/40' : ''
                }`}
              >
                <div className="px-3 py-2 font-medium text-gray-600">{f.label}</div>
                <label className={`flex items-start gap-2 px-3 py-2 ${mergeMode ? 'cursor-pointer' : ''}`}>
                  {mergeMode && (
                    <input
                      type="radio"
                      name={`conflict-${f.key}`}
                      checked={choices[f.key]}
                      onChange={() => setChoices((c) => ({ ...c, [f.key]: true }))}
                      className="mt-0.5 h-3.5 w-3.5 text-indigo-600"
                    />
                  )}
                  <span className={`break-words ${differs ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{mv}</span>
                </label>
                <label className={`flex items-start gap-2 px-3 py-2 ${mergeMode ? 'cursor-pointer' : ''}`}>
                  {mergeMode && (
                    <input
                      type="radio"
                      name={`conflict-${f.key}`}
                      checked={!choices[f.key]}
                      onChange={() => setChoices((c) => ({ ...c, [f.key]: false }))}
                      className="mt-0.5 h-3.5 w-3.5 text-indigo-600"
                    />
                  )}
                  <span className={`break-words ${differs ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{tv}</span>
                </label>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          {mergeMode ? (
            <button
              onClick={handleMerge}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Apply Merge
            </button>
          ) : (
            <>
              <button
                onClick={() => setMergeMode(true)}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
              >
                Merge…
              </button>
              <button
                onClick={onKeepTheirs}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep theirs
              </button>
              <button
                onClick={onKeepMine}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
              >
                Keep mine
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
