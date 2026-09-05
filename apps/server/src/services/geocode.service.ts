import { createHash } from 'crypto';

import { getRedisClient } from './presence.service.js';

/**
 * Server-side geocoding via Nominatim (OpenStreetMap).
 *
 * This lives on the server on purpose. Nominatim's usage policy forbids the
 * kind of traffic a browser autocomplete would generate, and requires a
 * identifying User-Agent that a browser will not let us set. So the browser
 * talks to `/api/geocode/*` and this module is the only thing that talks to
 * Nominatim, which lets us enforce three things centrally:
 *
 *   1. Max 1 request/second, globally serialized (`schedule`).
 *   2. Aggressive Redis caching, so repeat keystrokes never leave the box.
 *   3. A valid User-Agent + Referer on every outbound call.
 *
 * See https://operations.osmfoundation.org/policies/nominatim/
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const NOMINATIM_BASE_URL = (
  process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'
).replace(/\/+$/, '');

/**
 * Nominatim requires a User-Agent that identifies the application. Override
 * `GEOCODE_USER_AGENT` in production with something that carries real contact
 * details, otherwise you risk being blocked.
 */
const USER_AGENT =
  process.env.GEOCODE_USER_AGENT || 'TripSync/1.0 (self-hosted; contact: admin@localhost)';
const REFERER = process.env.GEOCODE_REFERER || 'https://localhost';
/** Optional, but Nominatim recommends it so they can reach you before blocking. */
const CONTACT_EMAIL = process.env.GEOCODE_CONTACT_EMAIL || '';

/** Nominatim's absolute limit is 1 req/sec; 1.1s leaves headroom for clock skew. */
const MIN_REQUEST_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;

/** Bump when the cached payload shape changes, so old entries are ignored. */
const CACHE_VERSION = 'v1';
const SEARCH_CACHE_TTL = 60 * 60 * 24 * 7; // 7 days — geocode results are stable
/** Empty results are cached briefly so typos don't re-hit Nominatim on every keystroke. */
const EMPTY_CACHE_TTL = 60 * 60; // 1 hour
const DESTINATION_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

const MAX_LIMIT = 10;
const DEFAULT_LIMIT = 5;

// ─── Types ───────────────────────────────────────────────────────────────────

/** Bounding box as [south, north, west, east], matching Nominatim's ordering. */
export type BoundingBox = [number, number, number, number];

export interface GeocodeResult {
  /** Nominatim place_id, stable enough to use as a React key. */
  placeId: string;
  /** Short label, e.g. "Tokyo Tower". */
  name: string;
  /** Full comma-separated label, e.g. "Tokyo Tower, 4, Shiba-koen, ...". */
  displayName: string;
  latitude: number;
  longitude: number;
  /** OSM class/type, e.g. "tourism" / "attraction". Useful for an icon hint. */
  category: string | null;
  type: string | null;
  boundingBox: BoundingBox | null;
}

export interface SearchOptions {
  limit?: number;
  /** Restrict/bias results to this box. */
  viewbox?: BoundingBox | null;
  /**
   * When true, results outside `viewbox` are dropped by Nominatim. The route
   * uses this for a first pass, then retries unbounded if nothing matched.
   */
  bounded?: boolean;
  /** Primary language tag for place names, e.g. "en". See `normalizeLanguage`. */
  language?: string;
}

// ─── Outbound request throttle ───────────────────────────────────────────────

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let lastRequestAt = 0;
/** Tail of the serialized request chain. Never rejects, so one failure can't stall the queue. */
let queueTail: Promise<unknown> = Promise.resolve();

/**
 * Serializes every outbound Nominatim call and spaces them at least
 * MIN_REQUEST_INTERVAL_MS apart, process-wide.
 *
 * Note this is per-process. Behind multiple server instances you would need a
 * Redis-based token bucket instead; the cache keeps real-world volume low
 * enough that this is a reasonable trade for now.
 */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  };

  // `.then(run, run)` so a rejected predecessor still lets this task proceed.
  const result = queueTail.then(run, run);
  queueTail = result.catch(() => undefined);
  return result;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

function cacheKey(parts: (string | number | boolean | null | undefined)[]): string {
  const hash = createHash('sha1').update(parts.join('\u0000')).digest('hex');
  return `geocode:${CACHE_VERSION}:${hash}`;
}

/** Normalizes a free-text query so trivial variations share a cache entry. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Reduces an Accept-Language header to a single primary tag, e.g.
 * "en-GB,en;q=0.9,fr;q=0.8" -> "en".
 *
 * Without this, Nominatim returns names in the local language ("東京タワー"
 * instead of "Tokyo Tower"), which is confusing in an English UI. Collapsing to
 * the primary tag also keeps the cache from fragmenting across the near-infinite
 * variations of that header.
 */
export function normalizeLanguage(header: string | undefined, fallback = 'en'): string {
  if (!header) return fallback;
  const primary = header.split(',')[0]?.split(';')[0]?.trim().toLowerCase() ?? '';
  // Keep just the language subtag and reject anything that isn't a plain tag.
  const tag = primary.split('-')[0];
  return /^[a-z]{2,3}$/.test(tag) ? tag : fallback;
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisClient().get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    // A cache outage must not take geocoding down with it.
    console.error('Geocode cache read failed:', (error as Error).message);
    return null;
  }
}

async function writeCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    console.error('Geocode cache write failed:', (error as Error).message);
  }
}

// ─── Nominatim response parsing ──────────────────────────────────────────────

function parseBoundingBox(raw: unknown): BoundingBox | null {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const nums = raw.map((v) => Number(v));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

/**
 * Maps a raw Nominatim `jsonv2` entry to our shape, returning null for any
 * entry without usable coordinates.
 */
function toResult(raw: any): GeocodeResult | null {
  const latitude = Number(raw?.lat);
  const longitude = Number(raw?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const displayName = typeof raw.display_name === 'string' ? raw.display_name : '';
  // `name` is often empty for addresses; fall back to the first display segment.
  const name =
    (typeof raw.name === 'string' && raw.name.trim()) || displayName.split(',')[0]?.trim() || displayName;
  if (!name) return null;

  return {
    placeId: String(raw.place_id ?? `${latitude},${longitude}`),
    name,
    displayName: displayName || name,
    latitude,
    longitude,
    category: typeof raw.category === 'string' ? raw.category : raw.class ?? null,
    type: typeof raw.type === 'string' ? raw.type : null,
    boundingBox: parseBoundingBox(raw.boundingbox),
  };
}

/** Nominatim wants `viewbox=west,north,east,south`. */
function viewboxParam(box: BoundingBox): string {
  const [south, north, west, east] = box;
  return `${west},${north},${east},${south}`;
}

// ─── Core request ────────────────────────────────────────────────────────────

async function requestNominatim(path: string, params: URLSearchParams): Promise<unknown> {
  if (CONTACT_EMAIL) params.set('email', CONTACT_EMAIL);

  const url = `${NOMINATIM_BASE_URL}${path}?${params.toString()}`;

  return schedule(async () => {
    const response = await fetch(url, {
      headers: {
        // The policy requires a valid Referer *or* User-Agent identifying the
        // application (a stock http-library User-Agent does not count). We send
        // both, which is strictly more than required.
        'User-Agent': USER_AGENT,
        Referer: REFERER,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new GeocodeUpstreamError(
        `Nominatim responded ${response.status}`,
        response.status === 429 || response.status === 503 ? 503 : 502
      );
    }

    return response.json();
  });
}

/** Raised when Nominatim itself fails, carrying the status to surface to the client. */
export class GeocodeUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'GeocodeUpstreamError';
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Forward-geocodes a free-text query, returning at most `limit` results.
 * Cached in Redis; only cache misses reach Nominatim.
 */
export async function searchPlaces(
  query: string,
  { limit = DEFAULT_LIMIT, viewbox = null, bounded = false, language = 'en' }: SearchOptions = {}
): Promise<GeocodeResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
  // `bounded` only changes the outcome when there's a box to bound to.
  const effectiveBounded = bounded && viewbox != null;
  const key = cacheKey([
    'search',
    normalized,
    effectiveLimit,
    viewbox ? viewboxParam(viewbox) : '',
    effectiveBounded ? '1' : '0',
    language,
  ]);

  const cached = await readCache<GeocodeResult[]>(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    q: normalized,
    format: 'jsonv2',
    limit: String(effectiveLimit),
    addressdetails: '1',
    'accept-language': language,
  });
  if (viewbox) {
    params.set('viewbox', viewboxParam(viewbox));
    if (effectiveBounded) params.set('bounded', '1');
  }

  const raw = await requestNominatim('/search', params);
  const results = Array.isArray(raw)
    ? raw.map(toResult).filter((r): r is GeocodeResult => r !== null)
    : [];

  await writeCache(key, results, results.length > 0 ? SEARCH_CACHE_TTL : EMPTY_CACHE_TTL);
  return results;
}

/**
 * Resolves a trip destination string to a bounding box, used to bias activity
 * searches toward where the trip actually is. Cached for 30 days; returns null
 * when the destination can't be resolved (callers then search unbiased).
 */
export async function resolveDestinationViewbox(destination: string): Promise<BoundingBox | null> {
  const normalized = normalizeQuery(destination);
  if (!normalized) return null;

  const key = cacheKey(['destination', normalized]);
  // Cached as `{ box }` so a resolved-but-empty lookup is distinguishable from a miss.
  const cached = await readCache<{ box: BoundingBox | null }>(key);
  if (cached) return cached.box;

  let box: BoundingBox | null = null;
  try {
    const [best] = await searchPlaces(normalized, { limit: 1 });
    box = best?.boundingBox ?? null;
  } catch (error) {
    // A failed bias lookup shouldn't fail the caller's search — and shouldn't
    // be cached either, so a transient outage doesn't stick for 30 days.
    console.error('Destination viewbox lookup failed:', (error as Error).message);
    return null;
  }

  await writeCache(key, { box }, DESTINATION_CACHE_TTL);
  return box;
}

/**
 * Destination-biased search used by the route: prefers results inside the
 * trip's area, but falls back to a global search when the bounded pass finds
 * nothing, so users can still add a place outside the destination box.
 */
export async function searchPlacesForTrip(
  query: string,
  destination: string | null,
  limit = DEFAULT_LIMIT,
  language = 'en'
): Promise<{ results: GeocodeResult[]; biased: boolean }> {
  const viewbox = destination ? await resolveDestinationViewbox(destination) : null;

  if (viewbox) {
    const bounded = await searchPlaces(query, { limit, viewbox, bounded: true, language });
    if (bounded.length > 0) return { results: bounded, biased: true };
    // Keep the viewbox for ranking preference, just stop excluding outsiders.
    const unbounded = await searchPlaces(query, { limit, viewbox, bounded: false, language });
    return { results: unbounded, biased: false };
  }

  return { results: await searchPlaces(query, { limit, language }), biased: false };
}

/** Exposed for the route's response so the UI can show OSM attribution. */
export const GEOCODE_ATTRIBUTION = '© OpenStreetMap contributors';
