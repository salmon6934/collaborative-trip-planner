import { Router, Request, Response, RequestHandler } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireMember } from '../middleware/rbac.js';
import { validate, createVoteSchema, castVoteSchema } from '../validation/schemas.js';
import {
  createPoll,
  castVote,
  resolvePoll,
  deletePoll,
  listPolls,
  getTallies,
  addWinnerToItinerary,
} from '../services/voting.service.js';
import { ErrorCodes } from '@tripsync/shared';

// ─── Trip-scoped vote routes (mounted on /api/trips) ─────────────────────────

export const tripVoteRoutes = Router({ mergeParams: true });

// All routes here are already behind authenticate from the trips router

/**
 * POST /api/trips/:id/votes
 * Create a new poll. Editor or Owner role required.
 */
tripVoteRoutes.post(
  '/',
  requireRole('owner', 'editor') as RequestHandler,
  validate(createVoteSchema) as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.auth!;
      const tripId = req.params.id as string;
      const { question, options } = req.body;

      const result = await createPoll(tripId, userId, question, options);

      if ('error' in result) {
        if (result.error === ErrorCodes.VOTE_INSUFFICIENT_OPTIONS) {
          res.status(400).json({
            code: ErrorCodes.VOTE_INSUFFICIENT_OPTIONS,
            message: 'At least two options are required',
          });
          return;
        }
      }

      res.status(201).json({ vote: (result as any).vote, options: (result as any).options });
    } catch (error) {
      console.error('Create poll error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * GET /api/trips/:id/votes
 * List all polls for a trip. Member role required.
 */
tripVoteRoutes.get(
  '/',
  requireMember() as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;

      const polls = await listPolls(tripId);
      res.status(200).json({ votes: polls });
    } catch (error) {
      console.error('List polls error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * DELETE /api/trips/:id/votes/:voteId
 * Delete a poll. Owner role required.
 */
tripVoteRoutes.delete(
  '/:voteId',
  requireRole('owner') as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const voteId = req.params.voteId as string;

      const result = await deletePoll(voteId);

      if ('error' in result) {
        res.status(404).json({
          code: 'VOTE_NOT_FOUND',
          message: 'Poll not found',
        });
        return;
      }

      res.status(200).json({ message: 'Poll deleted successfully' });
    } catch (error) {
      console.error('Delete poll error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

// ─── Vote-scoped routes (mounted on /api/votes) ─────────────────────────────

const votesRouter = Router();

// All vote-scoped routes require authentication
votesRouter.use(authenticate);

/**
 * POST /api/votes/:id/respond
 * Cast a vote on a poll. Any authenticated user (membership checked by poll's trip).
 */
votesRouter.post(
  '/:id/respond',
  validate(castVoteSchema) as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.auth!;
      const voteId = req.params.id as string;
      const { optionId } = req.body;

      const result = await castVote(voteId, optionId, userId);

      if ('error' in result) {
        if (result.error === ErrorCodes.VOTE_POLL_RESOLVED) {
          res.status(400).json({
            code: ErrorCodes.VOTE_POLL_RESOLVED,
            message: 'This poll has already been resolved',
          });
          return;
        }
        if (result.error === ErrorCodes.VOTE_ALREADY_CAST) {
          res.status(409).json({
            code: ErrorCodes.VOTE_ALREADY_CAST,
            message: 'You have already voted on this poll',
          });
          return;
        }
        if (result.error === 'VOTE_NOT_FOUND') {
          res.status(404).json({
            code: 'VOTE_NOT_FOUND',
            message: 'Poll not found',
          });
          return;
        }
      }

      res.status(201).json({ response: (result as any).response });
    } catch (error) {
      console.error('Cast vote error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * GET /api/votes/:id/tallies
 * Get vote tallies for a poll.
 */
votesRouter.get(
  '/:id/tallies',
  async (req: Request, res: Response) => {
    try {
      const voteId = req.params.id as string;

      const tallies = await getTallies(voteId);
      res.status(200).json({ tallies });
    } catch (error) {
      console.error('Get tallies error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * PUT /api/votes/:id/resolve
 * Resolve a poll. Owner or poll creator.
 */
votesRouter.put(
  '/:id/resolve',
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.auth!;
      const voteId = req.params.id as string;
      const { winningOptionId } = req.body;

      if (!winningOptionId) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'winningOptionId is required',
        });
        return;
      }

      const result = await resolvePoll(voteId, winningOptionId, userId);

      if ('error' in result) {
        if (result.error === 'VOTE_NOT_FOUND') {
          res.status(404).json({
            code: 'VOTE_NOT_FOUND',
            message: 'Poll not found',
          });
          return;
        }
        if (result.error === ErrorCodes.VOTE_POLL_RESOLVED) {
          res.status(400).json({
            code: ErrorCodes.VOTE_POLL_RESOLVED,
            message: 'This poll has already been resolved',
          });
          return;
        }
      }

      res.status(200).json({ vote: (result as any).vote });
    } catch (error) {
      console.error('Resolve poll error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * POST /api/votes/:id/add-to-itinerary
 * Add the winning option to the itinerary as an activity block.
 */
votesRouter.post(
  '/:id/add-to-itinerary',
  async (req: Request, res: Response) => {
    try {
      const voteId = req.params.id as string;
      const { dayId } = req.body;

      if (!dayId) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'dayId is required',
        });
        return;
      }

      const result = await addWinnerToItinerary(voteId, dayId);

      if ('error' in result) {
        res.status(400).json({
          code: result.error,
          message: result.error === 'VOTE_NOT_RESOLVED'
            ? 'Poll has not been resolved yet'
            : 'Winning option not found',
        });
        return;
      }

      res.status(201).json({ block: (result as any).block });
    } catch (error) {
      console.error('Add winner to itinerary error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

export default votesRouter;
