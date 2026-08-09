import { Request, Response, NextFunction } from 'express';
import { getMembership } from '../services/trip.service.js';
import { TripRole } from '@trip-planner/shared';

// Extend Express Request to include member role
declare global {
  namespace Express {
    interface Request {
      memberRole?: string;
    }
  }
}

/**
 * Middleware that checks if the authenticated user is a member of the trip
 * and has one of the specified roles.
 *
 * Expects `req.auth.userId` to be set (i.e., `authenticate` middleware ran first).
 * Reads tripId from `req.params.id` or `req.params.tripId`.
 */
export function requireRole(...roles: TripRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({
        code: 'AUTH_MISSING_TOKEN',
        message: 'Authentication required',
      });
      return;
    }

    const rawTripId = req.params.id || req.params.tripId;
    const tripId = Array.isArray(rawTripId) ? rawTripId[0] : rawTripId;
    if (!tripId) {
      res.status(400).json({
        code: 'MISSING_TRIP_ID',
        message: 'Trip ID is required',
      });
      return;
    }

    const member = await getMembership(tripId, userId);

    if (!member || !roles.includes(member.role as TripRole)) {
      res.status(403).json({
        code: 'TRIP_PERMISSION_DENIED',
        message: 'Permission denied',
      });
      return;
    }

    req.memberRole = member.role;
    next();
  };
}

/**
 * Middleware that only checks if the user is a member of the trip (any role).
 * Useful for read-only endpoints where all members should have access.
 */
export function requireMember() {
  return requireRole('owner', 'editor', 'viewer');
}
