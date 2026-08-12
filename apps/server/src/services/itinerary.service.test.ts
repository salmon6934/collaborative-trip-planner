import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockOrderBy = vi.fn();
const mockWhereResult = vi.fn();
const mockWhere = vi.fn(() => {
  const result = {
    orderBy: mockOrderBy,
    then: (resolve: any, reject?: any) => mockWhereResult().then(resolve, reject),
  };
  return result;
});
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

// For update and delete
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

const mockDeleteReturning = vi.fn();
const mockDeleteWhere = vi.fn(() => ({ returning: mockDeleteReturning }));
const mockDeleteFrom = vi.fn(() => ({ where: mockDeleteWhere }));
const mockDelete = vi.fn(() => mockDeleteFrom);

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: any[]) => (mockInsert as any)(...args),
    select: (...args: any[]) => (mockSelect as any)(...args),
    update: (...args: any[]) => (mockUpdate as any)(...args),
    delete: (...args: any[]) => (mockDeleteFrom as any)(...args),
  },
}));

vi.mock('../db/schema.js', () => ({
  days: { id: 'days.id', tripId: 'days.trip_id', date: 'days.date', dayNumber: 'days.day_number' },
  activityBlocks: {
    id: 'activity_blocks.id',
    dayId: 'activity_blocks.day_id',
    tripId: 'activity_blocks.trip_id',
    position: 'activity_blocks.position',
  },
  expenses: {
    id: 'expenses.id',
    activityBlockId: 'expenses.activity_block_id',
  },
}));

import { generateDays, calculatePosition, getDaysWithBlocks, createBlock, updateBlock, deleteBlock } from './itinerary.service.js';

describe('Itinerary Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDays', () => {
    it('should create correct number of days for a 5-day range', async () => {
      const startDate = new Date('2025-03-01');
      const endDate = new Date('2025-03-05');
      const tripId = 'trip-1';

      const fakeDays = [
        { id: 'd1', tripId, date: '2025-03-01', dayNumber: 1 },
        { id: 'd2', tripId, date: '2025-03-02', dayNumber: 2 },
        { id: 'd3', tripId, date: '2025-03-03', dayNumber: 3 },
        { id: 'd4', tripId, date: '2025-03-04', dayNumber: 4 },
        { id: 'd5', tripId, date: '2025-03-05', dayNumber: 5 },
      ];

      mockReturning.mockResolvedValueOnce(fakeDays);

      const result = await generateDays(tripId, startDate, endDate);

      expect(result).toHaveLength(5);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockValues).toHaveBeenCalledWith([
        { tripId, date: '2025-03-01', dayNumber: 1 },
        { tripId, date: '2025-03-02', dayNumber: 2 },
        { tripId, date: '2025-03-03', dayNumber: 3 },
        { tripId, date: '2025-03-04', dayNumber: 4 },
        { tripId, date: '2025-03-05', dayNumber: 5 },
      ]);
    });

    it('should create 1 day when start and end date are the same', async () => {
      const date = new Date('2025-06-15');
      const tripId = 'trip-2';

      const fakeDays = [{ id: 'd1', tripId, date: '2025-06-15', dayNumber: 1 }];
      mockReturning.mockResolvedValueOnce(fakeDays);

      const result = await generateDays(tripId, date, date);

      expect(result).toHaveLength(1);
      expect(mockValues).toHaveBeenCalledWith([
        { tripId, date: '2025-06-15', dayNumber: 1 },
      ]);
    });

    it('should return empty array when startDate is after endDate', async () => {
      const result = await generateDays('trip-3', new Date('2025-03-05'), new Date('2025-03-01'));

      expect(result).toEqual([]);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('calculatePosition', () => {
    it('should return 1.0 when both before and after are null', () => {
      expect(calculatePosition(null, null)).toBe(1.0);
    });

    it('should return half of after when before is null', () => {
      expect(calculatePosition(null, 2.0)).toBe(1.0);
      expect(calculatePosition(null, 1.0)).toBe(0.5);
    });

    it('should return before + 1.0 when after is null', () => {
      expect(calculatePosition(2.0, null)).toBe(3.0);
      expect(calculatePosition(5.0, null)).toBe(6.0);
    });

    it('should return midpoint when both before and after are provided', () => {
      expect(calculatePosition(1.0, 3.0)).toBe(2.0);
      expect(calculatePosition(1.0, 2.0)).toBe(1.5);
      expect(calculatePosition(2.5, 3.5)).toBe(3.0);
    });
  });

  describe('getDaysWithBlocks', () => {
    it('should return days sorted by dayNumber with blocks sorted by position', async () => {
      const fakeDays = [
        { id: 'd1', tripId: 'trip-1', date: '2025-03-01', dayNumber: 1 },
        { id: 'd2', tripId: 'trip-1', date: '2025-03-02', dayNumber: 2 },
      ];

      const fakeBlocks = [
        { id: 'b1', dayId: 'd1', tripId: 'trip-1', title: 'Breakfast', position: 1.0, category: 'food' },
        { id: 'b2', dayId: 'd1', tripId: 'trip-1', title: 'Museum', position: 2.0, category: 'activity' },
        { id: 'b3', dayId: 'd2', tripId: 'trip-1', title: 'Lunch', position: 1.0, category: 'food' },
      ];

      // First call: select days
      mockOrderBy.mockResolvedValueOnce(fakeDays);
      // Second call: select blocks
      mockOrderBy.mockResolvedValueOnce(fakeBlocks);

      const result = await getDaysWithBlocks('trip-1');

      expect(result).toHaveLength(2);
      expect(result[0].dayNumber).toBe(1);
      expect(result[0].blocks).toHaveLength(2);
      expect(result[0].blocks[0].title).toBe('Breakfast');
      expect(result[0].blocks[1].title).toBe('Museum');
      expect(result[1].dayNumber).toBe(2);
      expect(result[1].blocks).toHaveLength(1);
      expect(result[1].blocks[0].title).toBe('Lunch');
    });

    it('should return days with empty blocks array when no blocks exist', async () => {
      const fakeDays = [
        { id: 'd1', tripId: 'trip-1', date: '2025-03-01', dayNumber: 1 },
      ];

      mockOrderBy.mockResolvedValueOnce(fakeDays);
      mockOrderBy.mockResolvedValueOnce([]);

      const result = await getDaysWithBlocks('trip-1');

      expect(result).toHaveLength(1);
      expect(result[0].blocks).toEqual([]);
    });
  });

  describe('createBlock', () => {
    it('should create a block with position 1.0 when no existing blocks', async () => {
      // Mock: select existing blocks in the day → empty
      mockOrderBy.mockResolvedValueOnce([]);

      const fakeBlock = {
        id: 'block-1',
        dayId: 'day-1',
        tripId: 'trip-1',
        title: 'Breakfast',
        category: 'food',
        position: 1.0,
        createdBy: 'user-1',
      };
      mockReturning.mockResolvedValueOnce([fakeBlock]);

      const result = await createBlock('day-1', 'trip-1', {
        title: 'Breakfast',
        category: 'food',
        dayId: 'day-1',
      }, 'user-1');

      expect(result).toEqual(fakeBlock);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should append block after max position when blocks exist', async () => {
      // Mock: existing blocks with max position 2.0
      mockOrderBy.mockResolvedValueOnce([{ position: 2.0 }, { position: 1.0 }]);

      const fakeBlock = {
        id: 'block-3',
        dayId: 'day-1',
        tripId: 'trip-1',
        title: 'Museum',
        category: 'activity',
        position: 3.0,
        createdBy: 'user-1',
      };
      mockReturning.mockResolvedValueOnce([fakeBlock]);

      const result = await createBlock('day-1', 'trip-1', {
        title: 'Museum',
        category: 'activity',
        dayId: 'day-1',
      }, 'user-1');

      expect(result).toEqual(fakeBlock);
      // Position should be calculatePosition(2.0, null) = 3.0
      expect(result.position).toBe(3.0);
    });
  });

  describe('updateBlock', () => {
    it('should update block fields and return updated block', async () => {
      const fakeUpdated = {
        id: 'block-1',
        dayId: 'day-1',
        tripId: 'trip-1',
        title: 'Brunch',
        category: 'food',
        position: 1.0,
      };
      mockUpdateReturning.mockResolvedValueOnce([fakeUpdated]);

      const result = await updateBlock('block-1', { title: 'Brunch' });

      expect(result).toEqual(fakeUpdated);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
    });

    it('should return null when block not found', async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      const result = await updateBlock('nonexistent', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should return existing block when no fields to update', async () => {
      const existing = {
        id: 'block-1',
        dayId: 'day-1',
        tripId: 'trip-1',
        title: 'Breakfast',
        category: 'food',
        position: 1.0,
      };
      // When input is empty, it calls select().from().where() without orderBy
      mockWhereResult.mockResolvedValueOnce([existing]);

      const result = await updateBlock('block-1', {});

      expect(result).toEqual(existing);
    });
  });

  describe('deleteBlock', () => {
    it('should unlink expenses and delete the block', async () => {
      const fakeBlock = {
        id: 'block-1',
        dayId: 'day-1',
        tripId: 'trip-1',
        title: 'Breakfast',
        category: 'food',
        position: 1.0,
      };

      // select existing block (no orderBy)
      mockWhereResult.mockResolvedValueOnce([fakeBlock]);
      // update expenses (unlink) — uses mockUpdate chain
      mockUpdateReturning.mockResolvedValueOnce([]);
      // delete block
      mockDeleteReturning.mockResolvedValueOnce([fakeBlock]);

      const result = await deleteBlock('block-1');

      expect(result).toEqual(fakeBlock);
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return null when block does not exist', async () => {
      // select returns empty (no orderBy)
      mockWhereResult.mockResolvedValueOnce([]);

      const result = await deleteBlock('nonexistent');

      expect(result).toBeNull();
    });
  });
});
