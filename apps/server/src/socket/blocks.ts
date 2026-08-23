import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  createBlock,
  updateBlock,
  moveBlock,
  deleteBlock,
  CreateBlockInput,
  UpdateBlockInput,
} from '../services/itinerary.service.js';
import {
  createBlockSchema,
  updateBlockSchema,
  moveBlockSchema,
} from '../validation/schemas.js';
import { db } from '../db/index.js';
import { activityBlocks } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { checkSocketRateLimit } from '../middleware/rate-limit.js';
import { notifyTripMembers } from '../services/notification.service.js';

/**
 * Registers real-time block event handlers on a socket connection.
 * Handles create, update, move, and delete operations with last-write-wins
 * conflict resolution for concurrent edits.
 */
export function registerBlockHandlers(io: SocketIOServer, socket: Socket) {
  const userId = socket.data.userId as string;

  /**
   * block:create — Creates a new activity block, persists to DB, then broadcasts.
   */
  socket.on('block:create', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      // Rate limit check
      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      // Validate input
      const parsed = createBlockSchema.safeParse(data);
      if (!parsed.success) {
        callback?.({ error: 'VALIDATION_ERROR', message: 'Invalid block data', details: parsed.error.flatten() });
        return;
      }

      const input = parsed.data as CreateBlockInput;

      // Persist to DB
      const block = await createBlock(input.dayId, tripId, input, userId);

      // Acknowledge sender with success
      callback?.({ ok: true, block });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('block:created', { block, userId });

      // Create notifications for other trip members
      const notifications = await notifyTripMembers(
        tripId,
        userId,
        'block_created',
        'New activity added',
        `"${block.title}" was added to the itinerary`
      );

      // Emit real-time notification to each recipient's user room
      for (const notif of notifications) {
        io.to(`user:${notif.userId}`).emit('notification:new', notif);
      }
    } catch (error) {
      console.error('block:create error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to create block' });
    }
  });

  /**
   * block:update — Updates a block with last-write-wins conflict resolution.
   * Compares incoming updatedAt with current DB updatedAt. If incoming is older, rejects.
   */
  socket.on('block:update', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      // Rate limit check
      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      const { blockId, updatedAt: clientUpdatedAt, ...updateData } = data || {};

      if (!blockId || typeof blockId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'blockId is required' });
        return;
      }

      // Validate update fields
      const parsed = updateBlockSchema.safeParse(updateData);
      if (!parsed.success) {
        callback?.({ error: 'VALIDATION_ERROR', message: 'Invalid update data', details: parsed.error.flatten() });
        return;
      }

      // Last-write-wins: check timestamp if provided
      if (clientUpdatedAt) {
        const [existing] = await db
          .select({ updatedAt: activityBlocks.updatedAt })
          .from(activityBlocks)
          .where(eq(activityBlocks.id, blockId));

        if (!existing) {
          callback?.({ error: 'BLOCK_NOT_FOUND', message: 'Block not found' });
          return;
        }

        const clientTime = new Date(clientUpdatedAt).getTime();
        const dbTime = existing.updatedAt.getTime();

        if (clientTime < dbTime) {
          // Client's version is older — reject with current state
          const [current] = await db
            .select()
            .from(activityBlocks)
            .where(eq(activityBlocks.id, blockId));
          callback?.({ error: 'CONFLICT', message: 'A newer version exists', block: current });
          return;
        }
      }

      // Persist update
      const block = await updateBlock(blockId, parsed.data as UpdateBlockInput, userId);
      if (!block) {
        callback?.({ error: 'BLOCK_NOT_FOUND', message: 'Block not found' });
        return;
      }

      // Acknowledge sender
      callback?.({ ok: true, block });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('block:updated', { block, userId });
    } catch (error) {
      console.error('block:update error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to update block' });
    }
  });

  /**
   * block:move — Moves a block to a different day/position.
   */
  socket.on('block:move', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      // Rate limit check
      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      // Validate input
      const parsed = moveBlockSchema.safeParse(data);
      if (!parsed.success) {
        callback?.({ error: 'VALIDATION_ERROR', message: 'Invalid move data', details: parsed.error.flatten() });
        return;
      }

      const { blockId, targetDayId, targetPosition } = parsed.data;

      // Persist move
      const block = await moveBlock(blockId, targetDayId, targetPosition, userId);
      if (!block) {
        callback?.({ error: 'BLOCK_NOT_FOUND', message: 'Block not found' });
        return;
      }

      // Acknowledge sender
      callback?.({ ok: true, block });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('block:moved', { block, userId });

      // Create notifications for other trip members
      const notifications = await notifyTripMembers(
        tripId,
        userId,
        'block_moved',
        'Activity moved',
        `"${block.title}" was moved in the itinerary`
      );

      // Emit real-time notification to each recipient's user room
      for (const notif of notifications) {
        io.to(`user:${notif.userId}`).emit('notification:new', notif);
      }
    } catch (error) {
      console.error('block:move error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to move block' });
    }
  });

  /**
   * block:delete — Deletes a block after persisting to DB.
   */
  socket.on('block:delete', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      // Rate limit check
      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      const { blockId } = data || {};

      if (!blockId || typeof blockId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'blockId is required' });
        return;
      }

      // Persist deletion
      const block = await deleteBlock(blockId, userId);
      if (!block) {
        callback?.({ error: 'BLOCK_NOT_FOUND', message: 'Block not found' });
        return;
      }

      // Acknowledge sender
      callback?.({ ok: true, block });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('block:deleted', { blockId: block.id, userId });

      // Create notifications for other trip members
      const notifications = await notifyTripMembers(
        tripId,
        userId,
        'block_deleted',
        'Activity removed',
        `"${block.title}" was removed from the itinerary`
      );

      // Emit real-time notification to each recipient's user room
      for (const notif of notifications) {
        io.to(`user:${notif.userId}`).emit('notification:new', notif);
      }
    } catch (error) {
      console.error('block:delete error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to delete block' });
    }
  });
}
