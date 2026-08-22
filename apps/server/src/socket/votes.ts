import { Server as SocketIOServer, Socket } from 'socket.io';
import {
  createPoll,
  castVote,
  resolvePoll,
  getTallies,
  CreatePollOption,
} from '../services/voting.service.js';
import { checkSocketRateLimit } from '../middleware/rate-limit.js';
import { notifyTripMembers } from '../services/notification.service.js';

/**
 * Registers real-time vote event handlers on a socket connection.
 * Handles poll creation, vote casting, and poll resolution broadcasts.
 */
export function registerVoteHandlers(io: SocketIOServer, socket: Socket) {
  const userId = socket.data.userId as string;

  /**
   * vote:create — Creates a new poll, persists to DB, then broadcasts vote:created.
   */
  socket.on('vote:create', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      const { question, options } = data || {};

      if (!question || typeof question !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'Question is required' });
        return;
      }

      if (!Array.isArray(options) || options.length < 2) {
        callback?.({ error: 'VALIDATION_ERROR', message: 'At least two options are required' });
        return;
      }

      const result = await createPoll(tripId, userId, question, options as CreatePollOption[]);

      if ('error' in result) {
        callback?.({ error: result.error, message: 'Failed to create poll' });
        return;
      }

      callback?.({ ok: true, vote: result.vote, options: result.options });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('vote:created', {
        vote: result.vote,
        options: result.options,
        userId,
      });

      // Notify other trip members
      const notifications = await notifyTripMembers(
        tripId,
        userId,
        'block_created',
        'New poll created',
        `A new poll was created: "${question}"`
      );

      for (const notif of notifications) {
        io.to(`user:${notif.userId}`).emit('notification:new', notif);
      }
    } catch (error) {
      console.error('vote:create error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to create poll' });
    }
  });

  /**
   * vote:cast — Casts a vote on a poll option, then broadcasts vote:cast with updated tallies.
   */
  socket.on('vote:cast', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      const { voteId, optionId } = data || {};

      if (!voteId || typeof voteId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'voteId is required' });
        return;
      }

      if (!optionId || typeof optionId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'optionId is required' });
        return;
      }

      const result = await castVote(voteId, optionId, userId);

      if ('error' in result) {
        callback?.({ error: result.error, message: 'Failed to cast vote' });
        return;
      }

      // Get updated tallies after the vote
      const tallies = await getTallies(voteId);

      callback?.({ ok: true, response: result.response, tallies });

      // Broadcast to the entire room (including sender gets tallies from callback)
      socket.to(`trip:${tripId}`).emit('vote:cast', {
        voteId,
        optionId,
        userId,
        tallies,
      });
    } catch (error) {
      console.error('vote:cast error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to cast vote' });
    }
  });

  /**
   * vote:resolve — Resolves a poll, selects a winner, broadcasts vote:resolved.
   */
  socket.on('vote:resolve', async (data: any, callback?: (response: any) => void) => {
    try {
      const tripId = socket.data.tripId;
      if (!tripId) {
        callback?.({ error: 'NOT_IN_TRIP', message: 'You must join a trip first' });
        return;
      }

      if (!checkSocketRateLimit(userId)) {
        callback?.({ error: 'RATE_LIMIT_EXCEEDED', message: 'Too many mutations, please slow down' });
        return;
      }

      const { voteId, winningOptionId } = data || {};

      if (!voteId || typeof voteId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'voteId is required' });
        return;
      }

      if (!winningOptionId || typeof winningOptionId !== 'string') {
        callback?.({ error: 'VALIDATION_ERROR', message: 'winningOptionId is required' });
        return;
      }

      const result = await resolvePoll(voteId, winningOptionId, userId);

      if ('error' in result) {
        callback?.({ error: result.error, message: 'Failed to resolve poll' });
        return;
      }

      callback?.({ ok: true, vote: result.vote });

      // Broadcast to room excluding sender
      socket.to(`trip:${tripId}`).emit('vote:resolved', {
        voteId,
        winningOptionId,
        vote: result.vote,
        userId,
      });

      // Notify other trip members
      const notifications = await notifyTripMembers(
        tripId,
        userId,
        'block_created',
        'Poll resolved',
        `A poll has been resolved`
      );

      for (const notif of notifications) {
        io.to(`user:${notif.userId}`).emit('notification:new', notif);
      }
    } catch (error) {
      console.error('vote:resolve error:', error);
      callback?.({ error: 'INTERNAL_ERROR', message: 'Failed to resolve poll' });
    }
  });
}
