'use client';

import { useState } from 'react';

interface OptionInput {
  title: string;
  description: string;
}

interface CreatePollFormProps {
  onSubmit: (question: string, options: { title: string; description?: string }[]) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CreatePollForm({ onSubmit, onCancel, isSubmitting }: CreatePollFormProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<OptionInput[]>([
    { title: '', description: '' },
    { title: '', description: '' },
  ]);

  function handleAddOption() {
    setOptions((prev) => [...prev, { title: '', description: '' }]);
  }

  function handleRemoveOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOptionChange(index: number, field: keyof OptionInput, value: string) {
    setOptions((prev) =>
      prev.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedQuestion = question.trim();
    const validOptions = options
      .map((opt) => ({
        title: opt.title.trim(),
        description: opt.description.trim() || undefined,
      }))
      .filter((opt) => opt.title.length > 0);

    if (!trimmedQuestion || validOptions.length < 2) return;

    onSubmit(trimmedQuestion, validOptions);
  }

  const validOptionCount = options.filter((opt) => opt.title.trim().length > 0).length;
  const canSubmit = question.trim().length > 0 && validOptionCount >= 2 && !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">Create a Poll</h3>

      {/* Question */}
      <div className="mt-4">
        <label htmlFor="poll-question" className="block text-sm font-medium text-gray-700">
          Question
        </label>
        <input
          id="poll-question"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What should we do for dinner?"
          maxLength={500}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Options */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700">
          Options (minimum 2)
        </label>
        <div className="mt-2 space-y-3">
          {options.map((option, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={option.title}
                  onChange={(e) => handleOptionChange(index, 'title', e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  maxLength={200}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={option.description}
                  onChange={(e) => handleOptionChange(index, 'description', e.target.value)}
                  placeholder="Description (optional)"
                  maxLength={500}
                  className="block w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="mt-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition"
                  aria-label={`Remove option ${index + 1}`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddOption}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add option
        </button>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isSubmitting ? 'Creating...' : 'Create Poll'}
        </button>
      </div>
    </form>
  );
}
