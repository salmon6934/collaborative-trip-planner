import { eq, asc, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { days, activityBlocks, expenses } from '../db/schema.js';
import { logAction } from './activity-feed.service.js';

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


// ─── Activity Block CRUD ─────────────────────────────────────────────────────

export interface CreateBlockInput {
  title: string;
  description?: string | null;
  category: 'food' | 'travel' | 'stay' | 'activity';
  startTime?: string | null;
  endTime?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  estimatedCost?: number | null;
  currency?: string;
  dayId: string;
}

export interface UpdateBlockInput {
  title?: string;
  description?: string | null;
  category?: 'food' | 'travel' | 'stay' | 'activity';
  startTime?: string | null;
  endTime?: string | null;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  estimatedCost?: number | null;
  currency?: string;
}

/**
 * Creates an activity block in a day. Assigns position using fractional indexing,
 * appending to the end by default.
 */
export async function createBlock(dayId: string, tripId: string, input: CreateBlockInput, createdBy: string) {
  // Find the max position of existing blocks in this day
  const existingBlocks = await db
    .select({ position: activityBlocks.position })
    .from(activityBlocks)
    .where(eq(activityBlocks.dayId, dayId))
    .orderBy(desc(activityBlocks.position));

  const maxPosition = existingBlocks.length > 0 ? existingBlocks[0].position : null;
  const position = calculatePosition(maxPosition, null);

  const [block] = await db
    .insert(activityBlocks)
    .values({
      dayId,
      tripId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      locationName: input.locationName ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      estimatedCost: input.estimatedCost ?? null,
      currency: input.currency ?? 'INR',
      position,
      createdBy,
    })
    .returning();

  // Log activity (non-blocking)
  logAction(tripId, createdBy, 'created', 'activity_block', block.id, {
    title: input.title,
  }).catch(() => {});

  return block;
}

/**
 * Partially updates an activity block's fields.
 * Returns null if the block is not found.
 */
export async function updateBlock(blockId: string, input: UpdateBlockInput, userId?: string) {
  const updateData: Record<string, any> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.startTime !== undefined) updateData.startTime = input.startTime;
  if (input.endTime !== undefined) updateData.endTime = input.endTime;
  if (input.locationName !== undefined) updateData.locationName = input.locationName;
  if (input.latitude !== undefined) updateData.latitude = input.latitude;
  if (input.longitude !== undefined) updateData.longitude = input.longitude;
  if (input.estimatedCost !== undefined) updateData.estimatedCost = input.estimatedCost;
  if (input.currency !== undefined) updateData.currency = input.currency;

  if (Object.keys(updateData).length === 0) {
    // Nothing to update, just fetch the existing block
    const [existing] = await db
      .select()
      .from(activityBlocks)
      .where(eq(activityBlocks.id, blockId));
    return existing ?? null;
  }

  updateData.updatedAt = new Date();

  const [updated] = await db
    .update(activityBlocks)
    .set(updateData)
    .where(eq(activityBlocks.id, blockId))
    .returning();

  if (updated && userId) {
    // Log activity (non-blocking)
    logAction(updated.tripId, userId, 'updated', 'activity_block', blockId, {
      title: updated.title,
    }).catch(() => {});
  }

  return updated ?? null;
}

// ─── Drag-and-Drop Reordering ────────────────────────────────────────────────

/**
 * Moves a block to a different day and/or position.
 * Updates the block's dayId and position, and sets updatedAt.
 * Returns null if the block is not found.
 */
export async function moveBlock(blockId: string, targetDayId: string, targetPosition: number, userId?: string) {
  const [existing] = await db
    .select()
    .from(activityBlocks)
    .where(eq(activityBlocks.id, blockId));

  if (!existing) return null;

  const sourceDayId = existing.dayId;

  const [updated] = await db
    .update(activityBlocks)
    .set({
      dayId: targetDayId,
      position: targetPosition,
      updatedAt: new Date(),
    })
    .where(eq(activityBlocks.id, blockId))
    .returning();

  if (updated && userId && sourceDayId !== targetDayId) {
    // Log activity (non-blocking) — only log move when day actually changed
    logAction(updated.tripId, userId, 'moved', 'activity_block', blockId, {
      title: updated.title,
      fromDay: sourceDayId,
      toDay: targetDayId,
    }).catch(() => {});
  }

  return updated ?? null;
}

/**
 * Reorders blocks within a day by assigning sequential positions (1.0, 2.0, 3.0, ...).
 * Takes an array of block IDs in the desired order and reassigns positions accordingly.
 * Returns the updated blocks array.
 */
export async function reorderBlocks(dayId: string, blockIds: string[]) {
  const updatedBlocks = [];

  for (let i = 0; i < blockIds.length; i++) {
    const position = i + 1.0;
    const [updated] = await db
      .update(activityBlocks)
      .set({
        position,
        updatedAt: new Date(),
      })
      .where(and(eq(activityBlocks.id, blockIds[i]), eq(activityBlocks.dayId, dayId)))
      .returning();

    if (updated) {
      updatedBlocks.push(updated);
    }
  }

  return updatedBlocks;
}

/**
 * Deletes an activity block. First unlinks any associated expenses
 * by setting their activityBlockId to null.
 * Returns null if the block is not found.
 */
export async function deleteBlock(blockId: string, userId?: string) {
  // Check if block exists
  const [existing] = await db
    .select()
    .from(activityBlocks)
    .where(eq(activityBlocks.id, blockId));

  if (!existing) return null;

  // Unlink any expenses that reference this block
  await db
    .update(expenses)
    .set({ activityBlockId: null })
    .where(eq(expenses.activityBlockId, blockId));

  // Delete the block
  const [deleted] = await db
    .delete(activityBlocks)
    .where(eq(activityBlocks.id, blockId))
    .returning();

  if (deleted && userId) {
    // Log activity (non-blocking)
    logAction(deleted.tripId, userId, 'deleted', 'activity_block', blockId, {
      title: deleted.title,
    }).catch(() => {});
  }

  return deleted ?? null;
}
