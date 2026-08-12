import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { days, activityBlocks } from '../db/schema.js';

// ─── Day Generation ──────────────────────────────────────────────────────────

/**
 * Generates Day entries for each date in the trip's date range.
 * Inserts one row per date with sequential dayNumber starting at 1.
 */
export async function generateDays(tripId: string, startDate: Date, endDate: Date) {
  const dayRows: { tripId: string; date: string; dayNumber: number }[] = [];
  const current = new Date(startDate);
  let dayNumber = 1;

  while (current <= endDate) {
    dayRows.push({
      tripId,
      date: current.toISOString().split('T')[0],
      dayNumber,
    });
    current.setDate(current.getDate() + 1);
    dayNumber++;
  }

  if (dayRows.length === 0) {
    return [];
  }

  const inserted = await db.insert(days).values(dayRows).returning();
  return inserted;
}

// ─── Fractional Indexing ─────────────────────────────────────────────────────

/**
 * Calculates a position value between two existing positions using fractional indexing.
 * Used for ordering activity blocks without rewriting all positions on reorder.
 */
export function calculatePosition(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1.0;
  if (before === null) return after! / 2;
  if (after === null) return before + 1.0;
  return (before + after) / 2;
}

// ─── Days with Blocks ────────────────────────────────────────────────────────

/**
 * Fetches all days for a trip with their activity blocks.
 * Days are sorted by dayNumber ascending.
 * Blocks within each day are sorted by position ascending.
 */
export async function getDaysWithBlocks(tripId: string) {
  const allDays = await db
    .select()
    .from(days)
    .where(eq(days.tripId, tripId))
    .orderBy(asc(days.dayNumber));

  const allBlocks = await db
    .select()
    .from(activityBlocks)
    .where(eq(activityBlocks.tripId, tripId))
    .orderBy(asc(activityBlocks.position));

  // Group blocks by dayId
  const blocksByDay = new Map<string, typeof allBlocks>();
  for (const block of allBlocks) {
    const existing = blocksByDay.get(block.dayId) ?? [];
    existing.push(block);
    blocksByDay.set(block.dayId, existing);
  }

  return allDays.map((day) => ({
    ...day,
    blocks: blocksByDay.get(day.id) ?? [],
  }));
}
