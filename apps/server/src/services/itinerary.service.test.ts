import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockOrderBy = vi.fn();
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: any[]) => (mockInsert as any)(...args),
    select: (...args: any[]) => (mockSelect as any)(...args),
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
}));

import { generateDays, calculatePosition, getDaysWithBlocks } from './itinerary.service.js';

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
});
