import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mocks ────────────────────────────────────────────────────────────────

const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

const mockOffset = vi.fn();
const mockLimit = vi.fn(() => ({ offset: mockOffset }));
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

// For innerJoin
const mockInnerJoinWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockInnerJoin = vi.fn(() => ({ where: mockInnerJoinWhere }));
const mockJoinFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }));
const mockJoinSelect = vi.fn(() => ({ from: mockJoinFrom }));

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => {
      // If select is called with specific fields (for join), use join mock
      if (args.length > 0) return mockJoinSelect(...args);
      return mockSelect(...args);
    },
  },
}));

vi.mock('../db/schema.js', () => ({
  activityLog: {
    id: 'activity_log.id',
    tripId: 'activity_log.trip_id',
    userId: 'activity_log.user_id',
    action: 'activity_log.action',
    entityType: 'activity_log.entity_type',
    entityId: 'activity_log.entity_id',
    metadata: 'activity_log.metadata',
    createdAt: 'activity_log.created_at',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
  },
}));

import { logAction, getRecentActions, formatDescription, getActivityFeed } from './activity-feed.service.js';

describe('Activity Feed Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-establish mock chains
    mockValues.mockImplementation(() => ({ returning: mockReturning }));
    mockInsert.mockImplementation(() => ({ values: mockValues }));
    mockLimit.mockImplementation(() => ({ offset: mockOffset }));
    mockOrderBy.mockImplementation(() => ({ limit: mockLimit }));
    mockWhere.mockImplementation(() => ({ orderBy: mockOrderBy }));
    mockFrom.mockImplementation(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));
    mockInnerJoin.mockImplementation(() => ({ where: mockInnerJoinWhere }));
    mockInnerJoinWhere.mockImplementation(() => ({ orderBy: mockOrderBy }));
    mockJoinFrom.mockImplementation(() => ({ innerJoin: mockInnerJoin }));
    mockJoinSelect.mockImplementation(() => ({ from: mockJoinFrom }));
  });

  describe('logAction', () => {
    it('should insert activity log entry and return it', async () => {
      const fakeEntry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'created',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Breakfast' },
        createdAt: new Date('2025-01-01'),
      };

      mockReturning.mockResolvedValueOnce([fakeEntry]);

      const result = await logAction('trip-1', 'user-1', 'created', 'activity_block', 'block-1', { title: 'Breakfast' });

      expect(result).toEqual(fakeEntry);
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'created',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Breakfast' },
      });
    });

    it('should return null and log error when insert fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockReturning.mockRejectedValueOnce(new Error('DB connection error'));

      const result = await logAction('trip-1', 'user-1', 'created', 'activity_block', 'block-1');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log activity:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('should default metadata to null when not provided', async () => {
      const fakeEntry = {
        id: 'log-2',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'deleted',
        entityType: 'activity_block',
        entityId: 'block-2',
        metadata: null,
        createdAt: new Date(),
      };

      mockReturning.mockResolvedValueOnce([fakeEntry]);

      await logAction('trip-1', 'user-1', 'deleted', 'activity_block', 'block-2');

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: null })
      );
    });
  });

  describe('getRecentActions', () => {
    it('should return entries ordered by createdAt DESC with default limit/offset', async () => {
      const fakeEntries = [
        { id: 'log-2', tripId: 'trip-1', action: 'updated', createdAt: new Date('2025-01-02') },
        { id: 'log-1', tripId: 'trip-1', action: 'created', createdAt: new Date('2025-01-01') },
      ];

      mockOffset.mockResolvedValueOnce(fakeEntries);

      const result = await getRecentActions('trip-1');

      expect(result).toEqual(fakeEntries);
      expect(mockSelect).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(20);
      expect(mockOffset).toHaveBeenCalledWith(0);
    });

    it('should respect custom limit and offset', async () => {
      mockOffset.mockResolvedValueOnce([]);

      await getRecentActions('trip-1', 10, 5);

      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockOffset).toHaveBeenCalledWith(5);
    });
  });

  describe('formatDescription', () => {
    it('should format "created" action correctly', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'created',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Breakfast at Cafe' },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Alice');
      expect(result).toBe("Alice added 'Breakfast at Cafe'");
    });

    it('should format "updated" action correctly', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'updated',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Brunch' },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Bob');
      expect(result).toBe("Bob updated 'Brunch'");
    });

    it('should format "moved" action with day info', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'moved',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Museum Visit', fromDay: 2, toDay: 3 },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Charlie');
      expect(result).toBe("Charlie moved 'Museum Visit' from Day 2 to Day 3");
    });

    it('should format "deleted" action correctly', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'deleted',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: { title: 'Cancelled Tour' },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Diana');
      expect(result).toBe("Diana removed 'Cancelled Tour'");
    });

    it('should format "voted" action correctly', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'voted',
        entityType: 'vote',
        entityId: 'vote-1',
        metadata: { title: 'Best restaurant?' },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Eve');
      expect(result).toBe("Eve voted on 'Best restaurant?'");
    });

    it('should format "resolved" action correctly', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'resolved',
        entityType: 'vote',
        entityId: 'vote-1',
        metadata: { title: 'Where to eat?' },
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Frank');
      expect(result).toBe("Frank resolved poll 'Where to eat?'");
    });

    it('should use entityType as fallback when metadata has no title', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'created',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: {},
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Grace');
      expect(result).toBe("Grace added 'activity_block'");
    });

    it('should handle null metadata gracefully', () => {
      const entry = {
        id: 'log-1',
        tripId: 'trip-1',
        userId: 'user-1',
        action: 'deleted',
        entityType: 'activity_block',
        entityId: 'block-1',
        metadata: null,
        createdAt: new Date(),
      };

      const result = formatDescription(entry, 'Hank');
      expect(result).toBe("Hank removed 'activity_block'");
    });
  });

  describe('getActivityFeed', () => {
    it('should return enriched entries with user name and description', async () => {
      const fakeJoinedEntries = [
        {
          id: 'log-1',
          tripId: 'trip-1',
          userId: 'user-1',
          action: 'created',
          entityType: 'activity_block',
          entityId: 'block-1',
          metadata: { title: 'Breakfast' },
          createdAt: new Date('2025-01-01'),
          userName: 'Alice',
        },
      ];

      mockOffset.mockResolvedValueOnce(fakeJoinedEntries);

      const result = await getActivityFeed('trip-1', 20, 0);

      expect(result).toHaveLength(1);
      expect(result[0].userName).toBe('Alice');
      expect(result[0].description).toBe("Alice added 'Breakfast'");
      expect(result[0].id).toBe('log-1');
    });

    it('should return empty array when no activity exists', async () => {
      mockOffset.mockResolvedValueOnce([]);

      const result = await getActivityFeed('trip-no-activity');

      expect(result).toEqual([]);
    });
  });
});
