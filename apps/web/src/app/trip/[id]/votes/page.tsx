'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSocket } from '@/hooks/useSocket';
import { useVotes } from '@/hooks/useVotes';
import { PollCard, Poll } from '@/components/votes/PollCard';
import { CreatePollForm } from '@/components/votes/CreatePollForm';
import { ResolvePollModal } from '@/components/votes/ResolvePollModal';

export default function TripVotesPage() {
  const { data: session } = useSession();
  const params = useParams();
  const tripId = params.id as string;
  const token = (session as any)?.accessToken as string | undefined;
  const currentUserId = (session as any)?.user?.id as string | undefined;

  const { socket } = useSocket({ tripId, token });
  const {
    polls,
    tallies,
    userVotes,
    loading,
    createPoll,
    castVote,
    resolvePoll,
    deletePoll,
  } = useVotes({ socket, tripId, token, currentUserId });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [resolvingPoll, setResolvingPoll] = useState<Poll | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Fetch current user's trip role
  const fetchUserRole = useCallback(async () => {
    if (!token || !tripId || !currentUserId) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/trips/${tripId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const me = (data.members || []).find((m: any) => m.userId === currentUserId);
        if (me) setUserRole(me.role);
      }
    } catch {
      // Silently fail
    }
  }, [token, tripId, currentUserId]);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  const isOwner = userRole === 'owner';

  const activePolls = polls.filter((p) => !p.isResolved);
  const resolvedPolls = polls.filter((p) => p.isResolved);

  async function handleCreatePoll(question: string, options: { title: string; description?: string }[]) {
    setIsCreating(true);
    await createPoll(question, options);
    setIsCreating(false);
    setShowCreateForm(false);
  }

  async function handleResolvePoll(winningOptionId: string) {
    if (!resolvingPoll) return;
    setIsResolving(true);
    await resolvePoll(resolvingPoll.id, winningOptionId);
    setIsResolving(false);
    setResolvingPoll(null);
  }

  function canResolvePoll(poll: Poll): boolean {
    if (!currentUserId) return false;
    // Owner or poll creator can resolve
    return poll.createdBy === currentUserId;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Votes</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create polls and vote on activities with your group.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Poll
          </button>
        )}
      </div>

      {/* Create Poll Form */}
      {showCreateForm && (
        <div className="mt-6">
          <CreatePollForm
            onSubmit={handleCreatePoll}
            onCancel={() => setShowCreateForm(false)}
            isSubmitting={isCreating}
          />
        </div>
      )}

      {/* Active Polls */}
      {activePolls.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Active Polls ({activePolls.length})
          </h3>
          <div className="mt-3 space-y-4">
            {activePolls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                tallies={tallies[poll.id] || []}
                currentUserId={currentUserId || ''}
                userVoteOptionId={userVotes[poll.id] || null}
                onVote={(optionId) => castVote(poll.id, optionId)}
                onResolve={() => setResolvingPoll(poll)}
                onDelete={() => deletePoll(poll.id)}
                canResolve={canResolvePoll(poll)}
                canDelete={isOwner}
              />
            ))}
          </div>
        </section>
      )}

      {/* Resolved Polls */}
      {resolvedPolls.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-medium uppercase tracking-wide text-gray-500">
            Resolved Polls ({resolvedPolls.length})
          </h3>
          <div className="mt-3 space-y-4">
            {resolvedPolls.map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                tallies={tallies[poll.id] || []}
                currentUserId={currentUserId || ''}
                userVoteOptionId={userVotes[poll.id] || null}
                onVote={() => {}}
                onResolve={() => {}}
                onDelete={() => deletePoll(poll.id)}
                canResolve={false}
                canDelete={isOwner}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {polls.length === 0 && !showCreateForm && (
        <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-4 text-sm font-medium text-gray-900">No polls yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Create a poll to let your group vote on activities, restaurants, or anything else.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition"
          >
            Create your first poll
          </button>
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingPoll && (
        <ResolvePollModal
          poll={resolvingPoll}
          onResolve={handleResolvePoll}
          onClose={() => setResolvingPoll(null)}
          isSubmitting={isResolving}
        />
      )}
    </div>
  );
}
