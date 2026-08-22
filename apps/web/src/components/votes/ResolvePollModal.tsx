'use client';

import { useState } from 'react';
import type { Poll } from './PollCard';

interface ResolvePollModalProps {
  poll: Poll;
  onResolve: (winningOptionId: string) => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function ResolvePollModal({ poll, onResolve, onClose, isSubmitting }: ResolvePollModalProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOptionId) return;
    onResolve(selectedOptionId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Resolve Poll</h3>
        <p className="mt-1 text-sm text-gray-600">
          Select the winning option for &ldquo;{poll.question}&rdquo;
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <fieldset>
            <legend className="sr-only">Select winning option</legend>
            <div className="space-y-2">
              {poll.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                    selectedOptionId === option.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="winning-option"
                    value={option.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => setSelectedOptionId(option.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {option.title}
                    </span>
                    {option.description && (
                      <p className="text-xs text-gray-500">{option.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedOptionId || isSubmitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? 'Resolving...' : 'Resolve Poll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
