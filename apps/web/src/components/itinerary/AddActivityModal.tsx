'use client';

import { useState } from 'react';
import type { ActivityCategory } from '@trip-planner/shared';

interface AddActivityModalProps {
  dayId: string;
  tripId: string;
  token: string;
  onClose: () => void;
  onCreated: () => void;
}

export function AddActivityModal({ dayId, tripId, token, onClose, onCreated }: AddActivityModalProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ActivityCategory>('activity');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const body: Record<string, unknown> = {
        dayId,
        title,
        category,
      };

      if (startTime) body.startTime = startTime;
      if (endTime) body.endTime = endTime;
      if (locationName) body.locationName = locationName;
      if (estimatedCost) body.estimatedCost = parseFloat(estimatedCost);

      const res = await fetch(`${API_URL}/api/trips/${tripId}/blocks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create activity');
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create activity');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Add Activity</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
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

          {/* Category */}
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

          {/* Time range */}
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

          {/* Location */}
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

          {/* Estimated Cost */}
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

          {/* Actions */}
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
              {loading ? 'Adding...' : 'Add Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
