import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

const mockGroupBy = vi.fn();
const mockOrderBy = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
  },
}));

vi.mock('../db/schema.js', () => ({
  votes: {
    id: 'votes.id',
    tripId: 'votes.trip_id',
    question: 'votes.question',
    createdBy: 'votes.created_by',
    isResolved: 'votes.is_resolved',
    winningOptionId: 'votes.winning_option_id',
  },
  voteOptions: {
    id: 'vote_options.id',
    voteId: 'vote_options.vote_id',
    title: 'vote_options.title',
    description: 'vote_options.description',
    link: 'vote_options.link',
    imageUrl: 'vote_options.image_url',
  },
  voteResponses: {
    id: 'vote_responses.id',
    voteId: 'vote_responses.vote_id',
    optionId: 'vote_responses.option_id',
    userId: 'vote_responses.user_id',
  },
  activityBlocks: {
    id: 'activity_blocks.id',
    dayId: 'activity_blocks.day_id',
    tripId: 'activity_blocks.trip_id',
    position: 'activity_blocks.position',
  },
  days: {
    id: 'days.id',
    tripId: 'days.trip_id',
  },
  expenses: {
    id: 'expenses.id',
    activityBlockId: 'expenses.activity_block_id',
  },
}));

vi.mock('./itinerary.service.js', () => ({
  createBlock: vi.fn(),
}));

vi.mock('./activity-feed.service.js', () => ({
  logActivityAndBroadcast: vi.fn(() => Promise.resolve(null)),
}));

import { createPoll, castVote, hasUserVoted, getTallies, resolvePoll, listPolls } from './voting.service.js';
import { ErrorCodes } from '@trip-planner/shared';

describe('Voting Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish mock chains
    mockValues.mockImplementation(() => ({ returning: mockReturning }));
    mockInsert.mockImplementation(() => ({ values: mockValues }));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockSet.mockImplementation(() => ({ where: mockUpdateWhere }));
    mockUpdateWhere.mockImplementation(() => ({ returning: mockUpdateReturning }));
    mockUpdate.mockImplementation(() => ({ set: mockSet }));
  });

  describe('createPoll', () => {
    it('should create a poll with options and return the vote and options', async () => {
      const fakeVote = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        createdBy: 'user-1',
        isResolved: false,
        winningOptionId: null,
      };

      const fakeOptions = [
        { id: 'opt-1', voteId: 'vote-1', title: 'Pizza Place', description: null, link: null, imageUrl: null },
        { id: 'opt-2', voteId: 'vote-1', title: 'Sushi Bar', description: null, link: null, imageUrl: null },
      ];

      // First insert: vote
      mockReturning.mockResolvedValueOnce([fakeVote]);
      // Second insert: options
      mockReturning.mockResolvedValueOnce(fakeOptions);

      const result = await createPoll('trip-1', 'user-1', 'Where to eat?', [
        { title: 'Pizza Place' },
        { title: 'Sushi Bar' },
      ]);

      expect('error' in result).toBe(false);
      expect((result as any).vote).toEqual(fakeVote);
      expect((result as any).options).toEqual(fakeOptions);
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it('should return error when fewer than 2 options provided', async () => {
      const result = await createPoll('trip-1', 'user-1', 'Where to eat?', [
        { title: 'Only one option' },
      ]);

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.VOTE_INSUFFICIENT_OPTIONS);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should return error when zero options provided', async () => {
      const result = await createPoll('trip-1', 'user-1', 'Where to go?', []);

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.VOTE_INSUFFICIENT_OPTIONS);
    });
  });

  describe('castVote', () => {
    it('should cast a vote successfully when poll is open and user has not voted', async () => {
      const fakePoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: false,
        createdBy: 'user-1',
        winningOptionId: null,
      };

      // First select: get the poll
      mockWhere.mockResolvedValueOnce([fakePoll]);
      // Second select: hasUserVoted check — no existing responses
      mockWhere.mockResolvedValueOnce([]);

      const fakeResponse = {
        id: 'resp-1',
        voteId: 'vote-1',
        optionId: 'opt-1',
        userId: 'user-2',
      };
      // Insert: vote response
      mockReturning.mockResolvedValueOnce([fakeResponse]);

      const result = await castVote('vote-1', 'opt-1', 'user-2');

      expect('error' in result).toBe(false);
      expect((result as any).response).toEqual(fakeResponse);
    });

    it('should return error when poll is resolved', async () => {
      const resolvedPoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: true,
        createdBy: 'user-1',
        winningOptionId: 'opt-1',
      };

      mockWhere.mockResolvedValueOnce([resolvedPoll]);

      const result = await castVote('vote-1', 'opt-1', 'user-2');

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.VOTE_POLL_RESOLVED);
    });

    it('should enforce one-vote-per-user', async () => {
      const fakePoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: false,
        createdBy: 'user-1',
        winningOptionId: null,
      };

      // First select: get poll
      mockWhere.mockResolvedValueOnce([fakePoll]);
      // Second select: hasUserVoted — user already voted
      mockWhere.mockResolvedValueOnce([{ id: 'resp-existing', voteId: 'vote-1', optionId: 'opt-1', userId: 'user-2' }]);

      const result = await castVote('vote-1', 'opt-2', 'user-2');

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.VOTE_ALREADY_CAST);
      // Should not insert a new response
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should allow multiple different users to vote', async () => {
      const fakePoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: false,
        createdBy: 'user-1',
        winningOptionId: null,
      };

      // User 2 votes
      mockWhere.mockResolvedValueOnce([fakePoll]);
      mockWhere.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([{ id: 'resp-1', voteId: 'vote-1', optionId: 'opt-1', userId: 'user-2' }]);
      const result1 = await castVote('vote-1', 'opt-1', 'user-2');
      expect('error' in result1).toBe(false);

      // User 3 votes
      mockWhere.mockResolvedValueOnce([fakePoll]);
      mockWhere.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([{ id: 'resp-2', voteId: 'vote-1', optionId: 'opt-2', userId: 'user-3' }]);
      const result2 = await castVote('vote-1', 'opt-2', 'user-3');
      expect('error' in result2).toBe(false);

      // User 4 votes
      mockWhere.mockResolvedValueOnce([fakePoll]);
      mockWhere.mockResolvedValueOnce([]);
      mockReturning.mockResolvedValueOnce([{ id: 'resp-3', voteId: 'vote-1', optionId: 'opt-1', userId: 'user-4' }]);
      const result3 = await castVote('vote-1', 'opt-1', 'user-4');
      expect('error' in result3).toBe(false);
    });
  });

  describe('hasUserVoted', () => {
    it('should return true when user has already voted', async () => {
      mockWhere.mockResolvedValueOnce([{ id: 'resp-1', voteId: 'vote-1', optionId: 'opt-1', userId: 'user-1' }]);

      const result = await hasUserVoted('vote-1', 'user-1');
      expect(result).toBe(true);
    });

    it('should return false when user has not voted', async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await hasUserVoted('vote-1', 'user-1');
      expect(result).toBe(false);
    });
  });

  describe('getTallies', () => {
    it('should return vote counts grouped by option', async () => {
      const fakeTallies = [
        { optionId: 'opt-1', count: 3 },
        { optionId: 'opt-2', count: 1 },
      ];

      // For getTallies: select({}).from().where().groupBy()
      mockWhere.mockImplementationOnce(() => ({
        groupBy: mockGroupBy.mockResolvedValueOnce(fakeTallies),
      }));

      const result = await getTallies('vote-1');

      expect(result).toEqual(fakeTallies);
      expect(result[0].count).toBe(3);
      expect(result[1].count).toBe(1);
    });

    it('should return empty array when no votes cast', async () => {
      mockWhere.mockImplementationOnce(() => ({
        groupBy: mockGroupBy.mockResolvedValueOnce([]),
      }));

      const result = await getTallies('vote-1');
      expect(result).toEqual([]);
    });
  });

  describe('resolvePoll', () => {
    it('should mark poll as resolved with winning option', async () => {
      const fakePoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: false,
        createdBy: 'user-1',
        winningOptionId: null,
      };

      // Select poll
      mockWhere.mockResolvedValueOnce([fakePoll]);

      const updatedPoll = { ...fakePoll, isResolved: true, winningOptionId: 'opt-1' };
      mockUpdateReturning.mockResolvedValueOnce([updatedPoll]);

      const result = await resolvePoll('vote-1', 'opt-1', 'user-1');

      expect('error' in result).toBe(false);
      expect((result as any).vote.isResolved).toBe(true);
      expect((result as any).vote.winningOptionId).toBe('opt-1');
    });

    it('should return error when poll not found', async () => {
      mockWhere.mockResolvedValueOnce([]);

      const result = await resolvePoll('nonexistent', 'opt-1', 'user-1');

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe('VOTE_NOT_FOUND');
    });

    it('should return error when poll is already resolved', async () => {
      const resolvedPoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: true,
        createdBy: 'user-1',
        winningOptionId: 'opt-2',
      };

      mockWhere.mockResolvedValueOnce([resolvedPoll]);

      const result = await resolvePoll('vote-1', 'opt-1', 'user-1');

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.VOTE_POLL_RESOLVED);
    });

    it('should reject voting after poll is resolved', async () => {
      // First: resolve the poll
      const fakePoll = {
        id: 'vote-1',
        tripId: 'trip-1',
        question: 'Where to eat?',
        isResolved: false,
        createdBy: 'user-1',
        winningOptionId: null,
      };
      mockWhere.mockResolvedValueOnce([fakePoll]);
      mockUpdateReturning.mockResolvedValueOnce([{ ...fakePoll, isResolved: true, winningOptionId: 'opt-1' }]);
      await resolvePoll('vote-1', 'opt-1', 'user-1');

      // Then: try to vote on the resolved poll
      const resolvedPoll = { ...fakePoll, isResolved: true, winningOptionId: 'opt-1' };
      mockWhere.mockResolvedValueOnce([resolvedPoll]);

      const voteResult = await castVote('vote-1', 'opt-2', 'user-3');
      expect('error' in voteResult).toBe(true);
      expect((voteResult as any).error).toBe(ErrorCodes.VOTE_POLL_RESOLVED);
    });
  });

  describe('listPolls', () => {
    it('should return all polls with their options for a trip', async () => {
      const fakeVotes = [
        { id: 'vote-1', tripId: 'trip-1', question: 'Where to eat?', isResolved: false, createdBy: 'user-1' },
        { id: 'vote-2', tripId: 'trip-1', question: 'What to do?', isResolved: false, createdBy: 'user-2' },
      ];

      const fakeOptionsVote1 = [
        { id: 'opt-1', voteId: 'vote-1', title: 'Pizza' },
        { id: 'opt-2', voteId: 'vote-1', title: 'Sushi' },
      ];

      const fakeOptionsVote2 = [
        { id: 'opt-3', voteId: 'vote-2', title: 'Hiking' },
        { id: 'opt-4', voteId: 'vote-2', title: 'Beach' },
      ];

      // First call: get all votes for trip
      mockWhere.mockResolvedValueOnce(fakeVotes);
      // Second call: get options for vote-1
      mockWhere.mockResolvedValueOnce(fakeOptionsVote1);
      // Third call: get options for vote-2
      mockWhere.mockResolvedValueOnce(fakeOptionsVote2);

      const result = await listPolls('trip-1');

      expect(result).toHaveLength(2);
      expect(result[0].options).toEqual(fakeOptionsVote1);
      expect(result[1].options).toEqual(fakeOptionsVote2);
    });
  });
});
