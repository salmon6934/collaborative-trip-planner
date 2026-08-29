'use client';

import { useState } from 'react';
import type { ActivityCategory } from '@trip-planner/shared';

export interface ActivityFormValues {
  title: string;
  category: ActivityCategory;
  startTime?: string;
  endTime?: string;
  locationName?: string;
  estimatedCost?: number;
  description?: string;
}

interface AddActivityModalProps {
  mode?: 'create' | 'edit';
  dayId: string;
  tripId: string;
  token: string;
  /** Pre-fill values (edit mode). */
  initial?: Partial<ActivityFormValues>;
  onClose: () => void;
  onCreated: () => void;
  createBlock?: (input: {
    dayId: string;
    title: string;
    category: string;
    startTime?: string;
    endTime?: string;
    locationName?: string;
    estimatedCost?: number;
    description?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Edit-mode save handler. Returns conflict:true to signal the board's conflict dialog took over. */
  onSave?: (updates: Partial<ActivityFormValues>) => Promise<{ ok: boolean; error?: string; conflict?: boolean }>;
}

export function AddActivityModal({
  mode = 'create',
  dayId,
  tripId,
  token,
  initial,
  onClose,
  onCreated,
  createBlock,
  onSave,
}: AddActivityModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(initial?.category ?? 'activity');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const [locationName, setLocationName] = useState(initial?.locationName ?? '');
  const [estimatedCost, setEstimatedCost] = useState(
    initial?.estimatedCost != null ? String(initial.estimatedCost) : ''
  );
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEdit = mode === 'edit';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isEdit && onSave) {
        const updates: Partial<ActivityFormValues> = {
          title,
          category,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          locationName: locationName || undefined,
          estimatedCost: estimatedCost ? parseFloat(estimatedCost) : undefined,
          description: description || undefined,
        };
        const result = await onSave(updates);
        if (result.conflict) {
          // Conflict dialog takes over — just close the edit modal.
          onClose();
          return;
        }
        if (!result.ok) throw new Error(result.error || 'Failed to save changes');
        onCreated();
        return;
      }

      const input: Record<string, unknown> = { dayId, title, category };
      if (startTime) input.startTime = startTime;
      if (endTime) input.endTime = endTime;
      if (locationName) input.locationName = locationName;
      if (estimatedCost) input.estimatedCost = parseFloat(estimatedCost);
      if (description) input.description = description;

      if (createBlock) {
        const result = await createBlock(input as any);
        if (!result.ok) throw new Error(result.error || 'Failed to create activity');
        onCreated();
      } else {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${API_URL}/api/trips/${tripId}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to create activity');
        }
        onCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save activity');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {isEdit ? 'Edit Activity' : 'Add Activity'}
        </h2>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="activity-title" className="block text-sm font-medium text-gray-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Visit Eiffel Tower"
            />
          </div>

          <div>
            <label htmlFor="activity-category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="activity-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ActivityCategory)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="activity">🎯 Activity</option>
              <option value="food">🍽️ Food</option>
              <option value="travel">✈️ Travel</option>
              <option value="stay">🏨 Stay</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700">
                Start Time
              </label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-gray-700">
                End Time
              </label>
              <input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="location-name" className="block text-sm font-medium text-gray-700">
              Location
            </label>
            <input
              id="location-name"
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Champ de Mars, Paris"
            />
          </div>

          <div>
            <label htmlFor="estimated-cost" className="block text-sm font-medium text-gray-700">
              Estimated Cost
            </label>
            <input
              id="estimated-cost"
              type="number"
              step="0.01"
              min="0"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="25.00"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Any details, booking references, reminders…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
