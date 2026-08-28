'use client';

import { motion } from 'framer-motion';

export interface PollOption {
  id: string;
  voteId: string;
  title: string;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
}

export interface Poll {
  id: string;
  tripId: string;
  question: string;
  createdBy: string;
  isResolved: boolean;
  winningOptionId: string | null;
  createdAt: string;
  options: PollOption[];
}

export interface Tally {
  optionId: string;
  count: number;
}

interface PollCardProps {
  poll: Poll;
  tallies: Tally[];
  currentUserId: string;
  userVoteOptionId: string | null;
  onVote: (optionId: string) => void;
  onResolve: () => void;
  onDelete?: () => void;
  canResolve: boolean;
  canDelete: boolean;
}

export function PollCard({
  poll,
  tallies,
  currentUserId,
  userVoteOptionId,
  onVote,
  onResolve,
  onDelete,
  canResolve,
  canDelete,
}: PollCardProps) {
  const totalVotes = tallies.reduce((sum, t) => sum + t.count, 0);
  const hasVoted = userVoteOptionId !== null;

  function getTallyCount(optionId: string): number {
    return tallies.find((t) => t.optionId === optionId)?.count ?? 0;
  }

  function getPercentage(optionId: string): number {
    if (totalVotes === 0) return 0;
    return Math.round((getTallyCount(optionId) / totalVotes) * 100);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">{poll.question}</h3>
        {poll.isResolved && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            Resolved
          </span>
        )}
      </div>

      {/* Options with tally bars */}
      <div className="mt-4 space-y-3">
        {poll.options.map((option) => {
          const percentage = getPercentage(option.id);
          const isWinner = poll.winningOptionId === option.id;
          const isUserVote = userVoteOptionId === option.id;
          const canClick = !poll.isResolved && !hasVoted;

          return (
            <button
              key={option.id}
              onClick={() => canClick && onVote(option.id)}
              disabled={!canClick}
              className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition ${
                isWinner
                  ? 'border-green-300 bg-green-50'
                  : isUserVote
                    ? 'border-indigo-300 bg-indigo-50'
                    : canClick
                      ? 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      : 'border-gray-200 bg-gray-50'
              }`}
              aria-label={`Vote for ${option.title}`}
            >
              {/* Animated tally bar background */}
              <motion.div
                className={`absolute inset-y-0 left-0 ${
                  isWinner ? 'bg-green-200/60' : 'bg-indigo-100/60'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />

              {/* Content */}
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {option.title}
                  </span>
                  {isUserVote && (
                    <span className="text-xs text-indigo-600 font-medium">
                      (Your vote)
                    </span>
                  )}
                  {isWinner && (
                    <span className="text-xs text-green-700 font-medium">
                      ★ Winner
                    </span>
                  )}
                </div>
                {(hasVoted || poll.isResolved) && (
                  <span className="text-sm text-gray-600">
                    {getTallyCount(option.id)} ({percentage}%)
                  </span>
                )}
              </div>

              {option.description && (
                <p className="relative mt-1 text-xs text-gray-500">
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </span>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={onDelete}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
              title="Delete poll"
            >
              Delete
            </button>
          )}
          {canResolve && !poll.isResolved && (
            <button
              onClick={onResolve}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
