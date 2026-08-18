import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiter for auth routes: 10 requests per 15 minutes per IP.
 * Prevents brute-force login/signup attempts.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
});

/**
 * General API rate limiter: 120 requests per minute per IP.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later',
  },
});

/**
 * Socket.io event rate limiter for block mutations.
 * Tracks per-user event counts in a simple in-memory map.
 * Throttle: 30 mutations per minute per user.
 */
const socketEventCounts = new Map<string, { count: number; resetAt: number }>();

export function checkSocketRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = socketEventCounts.get(userId);

  if (!entry || now > entry.resetAt) {
    // New window
    socketEventCounts.set(userId, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }

  if (entry.count >= 30) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of socketEventCounts.entries()) {
    if (now > entry.resetAt) {
      socketEventCounts.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();
