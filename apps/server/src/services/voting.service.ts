import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { votes, voteOptions, voteResponses } from '../db/schema.js';
import { ErrorCodes } from '@trip-planner/shared';
import { createBlock, CreateBlockInput } from './itinerary.service.js';
import { logAction } from './activity-feed.service.js';

// ─── Poll Creation ───────────────────────────────────────────────────────────

export interface CreatePollOption {
  title: string;
  description?: string | null;
  link?: string | null;
  imageUrl?: string | null;
}

/**
 * Creates a new poll (vote) for a trip.
 * Validates that at least 2 options are provided.
 */
export async function createPoll(
  tripId: string,
  userId: string,
  question: string,
  options: CreatePollOption[]
) {
  if (options.length < 2) {
    return { error: ErrorCodes.VOTE_INSUFFICIENT_OPTIONS };
  }

  // Insert the vote record
  const [vote] = await db
    .insert(votes)
    .values({
      tripId,
      question,
      createdBy: userId,
    })
    .returning();

  // Insert vote options
  const optionRows = options.map((opt) => ({
    voteId: vote.id,
    title: opt.title,
    description: opt.description ?? null,
    link: opt.link ?? null,
    imageUrl: opt.imageUrl ?? null,
  }));

  const insertedOptions = await db
    .insert(voteOptions)
    .values(optionRows)
    .returning();

  // Log activity (non-blocking)
  logAction(tripId, userId, 'created', 'vote', vote.id, {
    title: question,
  }).catch(() => {});

  return { vote, options: insertedOptions };
}

// ─── Cast Vote ───────────────────────────────────────────────────────────────

/**
 * Casts a vote on a poll option.
 * Checks that user hasn't already voted and poll is not resolved.
 */
export async function castVote(voteId: string, optionId: string, userId: string) {
  // Check if poll is resolved
  const [poll] = await db
    .select()
    .from(votes)
    .where(eq(votes.id, voteId));

  if (!poll) {
    return { error: 'VOTE_NOT_FOUND' };
  }

  if (poll.isResolved) {
    return { error: ErrorCodes.VOTE_POLL_RESOLVED };
  }

  // Check if user already voted
  const alreadyVoted = await hasUserVoted(voteId, userId);
  if (alreadyVoted) {
    return { error: ErrorCodes.VOTE_ALREADY_CAST };
  }

  // Insert vote response
  const [response] = await db
    .insert(voteResponses)
    .values({
      voteId,
      optionId,
      userId,
    })
    .returning();

  // Log activity (non-blocking)
  logAction(poll.tripId, userId, 'voted', 'vote', voteId, {
    title: poll.question,
  }).catch(() => {});

  return { response };
}

// ─── Has User Voted ──────────────────────────────────────────────────────────

/**
 * Checks if a user has already voted on a specific poll.
 */
export async function hasUserVoted(voteId: string, userId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(voteResponses)
    .where(and(eq(voteResponses.voteId, voteId), eq(voteResponses.userId, userId)));

  return existing.length > 0;
}

// ─── Get Tallies ─────────────────────────────────────────────────────────────

/**
 * Gets vote tallies for each option in a poll.
 * Returns an array of { optionId, count } objects.
 */
export async function getTallies(voteId: string) {
  const results = await db
    .select({
      optionId: voteResponses.optionId,
      count: count(voteResponses.id),
    })
    .from(voteResponses)
    .where(eq(voteResponses.voteId, voteId))
    .groupBy(voteResponses.optionId);

  return results;
}

// ─── Resolve Poll ────────────────────────────────────────────────────────────

/**
 * Resolves a poll by marking it as resolved and setting the winning option.
 */
export async function resolvePoll(voteId: string, winningOptionId: string, userId: string) {
  // Check if poll exists and user is authorized (owner or poll creator)
  const [poll] = await db
    .select()
    .from(votes)
    .where(eq(votes.id, voteId));

  if (!poll) {
    return { error: 'VOTE_NOT_FOUND' };
  }

  if (poll.isResolved) {
    return { error: ErrorCodes.VOTE_POLL_RESOLVED };
  }

  const [updated] = await db
    .update(votes)
    .set({
      isResolved: true,
      winningOptionId,
    })
    .where(eq(votes.id, voteId))
    .returning();

  // Log activity (non-blocking)
  logAction(poll.tripId, userId, 'resolved', 'vote', voteId, {
    title: poll.question,
  }).catch(() => {});

  return { vote: updated };
}

// ─── Add Winner to Itinerary ─────────────────────────────────────────────────

/**
 * Creates an ActivityBlock from the winning option's data.
 */
export async function addWinnerToItinerary(voteId: string, dayId: string) {
  // Get the poll and winning option
  const [poll] = await db
    .select()
    .from(votes)
    .where(eq(votes.id, voteId));

  if (!poll || !poll.winningOptionId) {
    return { error: 'VOTE_NOT_RESOLVED' };
  }

  const [winningOption] = await db
    .select()
    .from(voteOptions)
    .where(eq(voteOptions.id, poll.winningOptionId));

  if (!winningOption) {
    return { error: 'OPTION_NOT_FOUND' };
  }

  // Create an activity block from the winning option
  const blockInput: CreateBlockInput = {
    title: winningOption.title,
    description: winningOption.description ?? null,
    category: 'activity',
    dayId,
  };

  const block = await createBlock(dayId, poll.tripId, blockInput, poll.createdBy);
  return { block };
}

// ─── Delete Poll ─────────────────────────────────────────────────────────────

/**
 * Deletes a poll and all associated options/responses (cascade).
 * Only the trip owner should be able to delete polls.
 */
export async function deletePoll(voteId: string) {
  const [poll] = await db
    .select()
    .from(votes)
    .where(eq(votes.id, voteId));

  if (!poll) {
    return { error: 'VOTE_NOT_FOUND' };
  }

  await db.delete(votes).where(eq(votes.id, voteId));

  return { deleted: true, tripId: poll.tripId };
}

// ─── List Polls ──────────────────────────────────────────────────────────────

/**
 * Lists all polls for a trip with their options.
 */
export async function listPolls(tripId: string) {
  const allVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.tripId, tripId));

  // Fetch options for each vote
  const pollsWithOptions = await Promise.all(
    allVotes.map(async (vote) => {
      const options = await db
        .select()
        .from(voteOptions)
        .where(eq(voteOptions.voteId, vote.id));

      return { ...vote, options };
    })
  );

  return pollsWithOptions;
}
