'use client';

import { useEffect, useState } from 'react';

/**
 * Debounced place lookup against the server's Nominatim proxy
 * (`GET /api/geocode/search`).
 *
 * The browser never calls Nominatim directly — their usage policy requires an
 * identifying User-Agent and caps request rate, both of which are enforced
 * server-side. See `apps/server/src/services/geocode.service.ts`.
 */

export interface GeocodeResult {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  category: string | null;
  type: string | null;
}

interface UseGeocodeSearchOptions {
  /** Raw text from the input. Debounced internally. */
  query: string;
  token: string | undefined;
  /** Biases results toward this trip's destination when provided. */
  tripId?: string;
  /**
   * Set false to suspend searching — e.g. while the field still shows a
   * prefilled value the user hasn't touched, or right after picking a result.
   */
  enabled?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const DEBOUNCE_MS = 400;
/** Mirrors the server's threshold, so we don't spend a request on 1–2 characters. */
const MIN_QUERY_LENGTH = 3;

export function useGeocodeSearch({
  query,
  token,
  tripId,
  enabled = true,
}: UseGeocodeSearchOptions) {
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  /** True once a search has completed, so callers can tell "no matches" from "not searched yet". */
  const [searched, setSearched] = useState(false);

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (!enabled || !token || tooShort) {
      setResults([]);
      setLoading(false);
      setError('');
      setSearched(false);
      return;
    }

    // Shown immediately so the field reacts to typing, even though the request
    // itself waits out the debounce.
    setLoading(true);
    setError('');

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (tripId) params.set('tripId', tripId);

        const res = await fetch(`${API_URL}/api/geocode/search?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Location search failed');
        }

        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setSearched(true);
      } catch (err) {
        // An abort means a newer keystroke superseded this request; the newer
        // effect run owns the state from here, so leave it alone.
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Location search failed');
        setResults([]);
        setSearched(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, tooShort, token, tripId, enabled]);

  return { results, loading, error, searched, tooShort };
}
