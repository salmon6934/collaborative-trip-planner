import { describe, it, expect } from 'vitest';
import {
  assignDayColors,
  toMapPins,
  groupPinsByDay,
  buildRouteSegments,
  computePinsCenter,
  type BlockLike,
  type MapPin,
} from './map-utils';

/** Builds a MapPin with sensible defaults for tests. */
function pin(overrides: Partial<MapPin> & Pick<MapPin, 'blockId' | 'dayNumber'>): MapPin {
  return {
    latitude: 35.68,
    longitude: 139.76,
    title: overrides.blockId,
    category: 'activity',
    startTime: null,
    ...overrides,
  };
}

/** Builds a BlockLike with sensible defaults for tests. */
function block(overrides: Partial<BlockLike> & Pick<BlockLike, 'id' | 'dayNumber'>): BlockLike {
  return {
    title: overrides.id,
    category: 'activity',
    latitude: 35.68,
    longitude: 139.76,
    startTime: null,
    ...overrides,
  };
}

const HEX = /^#[0-9a-f]{6}$/;

describe('assignDayColors', () => {
  it('returns one distinct color per day for a small trip', () => {
    const colors = assignDayColors(5);
    expect(colors.size).toBe(5);
    for (let day = 1; day <= 5; day++) {
      expect(colors.get(day)).toMatch(HEX);
    }
    const unique = new Set(colors.values());
    expect(unique.size).toBe(5);
  });

  it('generates distinct colors even beyond the fixed palette', () => {
    const colors = assignDayColors(20);
    expect(colors.size).toBe(20);
    const unique = new Set(colors.values());
    expect(unique.size).toBe(20);
    for (const value of colors.values()) {
      expect(value).toMatch(HEX);
    }
  });

  it('returns an empty map for non-positive or invalid day counts', () => {
    expect(assignDayColors(0).size).toBe(0);
    expect(assignDayColors(-3).size).toBe(0);
    expect(assignDayColors(Number.NaN).size).toBe(0);
  });

  it('is deterministic across calls', () => {
    expect([...assignDayColors(7)]).toEqual([...assignDayColors(7)]);
  });

  // Property-style check: for many trip sizes, colors are unique and keyed 1..N.
  it('property: colors are unique and cover 1..N for many sizes', () => {
    for (let n = 1; n <= 40; n++) {
      const colors = assignDayColors(n);
      expect(colors.size).toBe(n);
      expect(new Set(colors.values()).size).toBe(n);
      for (let day = 1; day <= n; day++) {
        expect(colors.get(day)).toMatch(HEX);
      }
    }
  });
});

describe('toMapPins', () => {
  it('keeps only blocks that have both coordinates', () => {
    const blocks: BlockLike[] = [
      block({ id: 'a', dayNumber: 1, latitude: 1, longitude: 2 }),
      block({ id: 'b', dayNumber: 1, latitude: null, longitude: 2 }),
      block({ id: 'c', dayNumber: 1, latitude: 1, longitude: null }),
      block({ id: 'd', dayNumber: 2, latitude: null, longitude: null }),
      block({ id: 'e', dayNumber: 2, latitude: NaN, longitude: 5 }),
    ];
    const pins = toMapPins(blocks);
    expect(pins.map((p) => p.blockId)).toEqual(['a']);
  });

  it('maps block fields onto the pin shape', () => {
    const pins = toMapPins([
      block({
        id: 'x',
        dayNumber: 3,
        title: 'Sushi',
        category: 'food',
        latitude: 10,
        longitude: 20,
        startTime: '12:30',
      }),
    ]);
    expect(pins[0]).toEqual({
      blockId: 'x',
      latitude: 10,
      longitude: 20,
      title: 'Sushi',
      category: 'food',
      dayNumber: 3,
      startTime: '12:30',
    });
  });
});

describe('groupPinsByDay', () => {
  it('groups pins by day and orders days ascending', () => {
    const grouped = groupPinsByDay([
      pin({ blockId: 'a', dayNumber: 2 }),
      pin({ blockId: 'b', dayNumber: 1 }),
      pin({ blockId: 'c', dayNumber: 2 }),
    ]);
    expect([...grouped.keys()]).toEqual([1, 2]);
    expect(grouped.get(1)!.map((p) => p.blockId)).toEqual(['b']);
    expect(grouped.get(2)!.map((p) => p.blockId)).toEqual(['a', 'c']);
  });

  it('orders pins within a day chronologically by start time', () => {
    const grouped = groupPinsByDay([
      pin({ blockId: 'late', dayNumber: 1, startTime: '18:00' }),
      pin({ blockId: 'early', dayNumber: 1, startTime: '08:00' }),
      pin({ blockId: 'noon', dayNumber: 1, startTime: '12:00' }),
    ]);
    expect(grouped.get(1)!.map((p) => p.blockId)).toEqual(['early', 'noon', 'late']);
  });

  it('places pins without a start time after timed pins', () => {
    const grouped = groupPinsByDay([
      pin({ blockId: 'untimed', dayNumber: 1, startTime: null }),
      pin({ blockId: 'timed', dayNumber: 1, startTime: '09:00' }),
    ]);
    expect(grouped.get(1)!.map((p) => p.blockId)).toEqual(['timed', 'untimed']);
  });

  it('returns an empty map for no pins', () => {
    expect(groupPinsByDay([]).size).toBe(0);
  });
});

describe('buildRouteSegments', () => {
  it('connects consecutive pins within a day in time order', () => {
    const segments = buildRouteSegments([
      pin({ blockId: 'c', dayNumber: 1, startTime: '15:00' }),
      pin({ blockId: 'a', dayNumber: 1, startTime: '09:00' }),
      pin({ blockId: 'b', dayNumber: 1, startTime: '12:00' }),
    ]);
    expect(segments.map((s) => [s.from.blockId, s.to.blockId])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
    expect(segments.every((s) => s.distance === null && s.duration === null)).toBe(true);
  });

  it('does not connect pins across different days', () => {
    const segments = buildRouteSegments([
      pin({ blockId: 'd1a', dayNumber: 1, startTime: '09:00' }),
      pin({ blockId: 'd1b', dayNumber: 1, startTime: '10:00' }),
      pin({ blockId: 'd2a', dayNumber: 2, startTime: '09:00' }),
      pin({ blockId: 'd2b', dayNumber: 2, startTime: '10:00' }),
    ]);
    expect(segments.map((s) => [s.from.blockId, s.to.blockId])).toEqual([
      ['d1a', 'd1b'],
      ['d2a', 'd2b'],
    ]);
  });

  it('produces no segments for a day with a single pin', () => {
    expect(buildRouteSegments([pin({ blockId: 'solo', dayNumber: 1 })])).toEqual([]);
  });

  it('produces N-1 segments per day', () => {
    const pins = [1, 2, 3, 4].map((i) =>
      pin({ blockId: `p${i}`, dayNumber: 1, startTime: `0${i}:00` })
    );
    expect(buildRouteSegments(pins)).toHaveLength(3);
  });
});

describe('computePinsCenter', () => {
  it('averages coordinates of the pins', () => {
    const center = computePinsCenter([
      pin({ blockId: 'a', dayNumber: 1, latitude: 0, longitude: 0 }),
      pin({ blockId: 'b', dayNumber: 1, latitude: 10, longitude: 20 }),
    ]);
    expect(center).toEqual([5, 10]);
  });

  it('returns null when there are no pins', () => {
    expect(computePinsCenter([])).toBeNull();
  });
});
