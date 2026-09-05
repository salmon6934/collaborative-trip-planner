import { Router, Request, Response } from 'express';

import { authenticate } from '../middleware/auth.js';
import { geocodeRateLimiter } from '../middleware/rate-limit.js';
import {
  searchPlacesForTrip,
  normalizeLanguage,
  GeocodeUpstreamError,
  GEOCODE_ATTRIBUTION,
} from '../services/geocode.service.js';
import { getMembership, getTrip } from '../services/trip.service.js';

const router = Router();

/**
 * Shortest query we forward upstream. One or two characters match half the
 * planet and waste a rate-limited Nominatim call.
 */
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 200;
const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;

// Authentication is required so this can't be used as an open geocoding proxy.
router.use(authenticate);
router.use(geocodeRateLimiter);

/**
 * GET /api/geocode/search?q=..&tripId=..&limit=..
 *
 * Forward-geocodes `q` through the server-side Nominatim proxy.
 *
 * `tripId` is optional. When supplied (and the caller is a member), results are
 * biased toward that trip's destination, which makes short queries like
 * "station" resolve near the trip instead of somewhere random.
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;

    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (rawQuery.length < MIN_QUERY_LENGTH) {
      // Not an error — the client debounces into this while the user types.
      res.status(200).json({ results: [], biased: false, attribution: GEOCODE_ATTRIBUTION });
      return;
    }
    if (rawQuery.length > MAX_QUERY_LENGTH) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: `Query must be ${MAX_QUERY_LENGTH} characters or fewer`,
      });
      return;
    }

    const parsedLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Resolve the destination bias, verifying membership first.
    let destination: string | null = null;
    const tripId = typeof req.query.tripId === 'string' ? req.query.tripId : '';
    if (tripId) {
      const membership = await getMembership(tripId, userId);
      if (!membership) {
        res.status(403).json({
          code: 'TRIP_PERMISSION_DENIED',
          message: 'Permission denied',
        });
        return;
      }
      const trip = await getTrip(tripId);
      destination = trip?.destination ?? null;
    }

    // Prefer place names in the caller's language, so an English UI shows
    // "Tokyo Tower" rather than Nominatim's default local-language name.
    const language = normalizeLanguage(req.headers['accept-language']);

    const { results, biased } = await searchPlacesForTrip(rawQuery, destination, limit, language);

    res.status(200).json({ results, biased, attribution: GEOCODE_ATTRIBUTION });
  } catch (error) {
    if (error instanceof GeocodeUpstreamError) {
      console.error('Geocode upstream error:', error.message);
      res.status(error.status).json({
        code: 'GEOCODE_UPSTREAM_ERROR',
        message: 'Location search is temporarily unavailable. Please try again.',
      });
      return;
    }
    // AbortSignal.timeout rejects with a TimeoutError DOMException.
    if ((error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError') {
      console.error('Geocode request timed out');
      res.status(504).json({
        code: 'GEOCODE_TIMEOUT',
        message: 'Location search timed out. Please try again.',
      });
      return;
    }
    console.error('Geocode search error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  }
});

export default router;
