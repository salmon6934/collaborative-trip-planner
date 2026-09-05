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
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">Resolve Poll</h3>
        <p className="mt-1 text-sm text-muted-foreground">
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
                      ? 'border-primary bg-primary-tint'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="winning-option"
                    value={option.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => setSelectedOptionId(option.id)}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {option.title}
                    </span>
                    {option.description && (
                      <p className="text-xs text-muted-foreground">{option.description}</p>
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
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedOptionId || isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? 'Resolving...' : 'Resolve Poll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
