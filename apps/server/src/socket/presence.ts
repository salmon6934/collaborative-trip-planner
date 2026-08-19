import { Server as SocketIOServer, Socket } from 'socket.io';
import * as presenceService from '../services/presence.service.js';

/**
 * Registers presence-related socket event handlers.
 * Handles heartbeat, editing state, and cursor (day viewing) events.
 * Join/leave are handled in the main socket index.ts since they tie into
 * the existing join:trip / disconnect lifecycle.
 */
export function registerPresenceHandlers(io: SocketIOServer, socket: Socket) {
  const userId = socket.data.userId as string;

  /**
   * presence:heartbeat — Refreshes the user's presence TTL in Redis.
   * Client should emit this every 25s to stay "online".
   */
  socket.on('presence:heartbeat', async () => {
    try {
      const tripId = socket.data.tripId as string | undefined;
      if (!tripId) return;

      await presenceService.heartbeat(tripId, userId);
    } catch (error) {
      console.error('presence:heartbeat error:', error);
    }
  });

  /**
   * presence:editing — Updates which block the user is editing.
   * Broadcasts to the room so other users see the editing indicator.
   * Send { blockId: string | null } — null means stopped editing.
   */
  socket.on('presence:editing', async (data: { blockId: string | null }) => {
    try {
      const tripId = socket.data.tripId as string | undefined;
      if (!tripId) return;

      const blockId = data?.blockId ?? null;

      await presenceService.setEditing(tripId, userId, blockId);

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('presence:editing', {
        userId,
        blockId,
      });
    } catch (error) {
      console.error('presence:editing error:', error);
    }
  });

  /**
   * presence:cursor — Updates which day the user is currently viewing.
   * Broadcasts to the room so others can see "X is viewing Day N".
   * Send { dayNumber: number }.
   */
  socket.on('presence:cursor', async (data: { dayNumber: number }) => {
    try {
      const tripId = socket.data.tripId as string | undefined;
      if (!tripId) return;

      const dayNumber = data?.dayNumber;
      if (typeof dayNumber !== 'number') return;

      await presenceService.setCursor(tripId, userId, dayNumber);

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('presence:cursor', {
        userId,
        dayNumber,
      });
    } catch (error) {
      console.error('presence:cursor error:', error);
    }
  });
}
