'use client';

/**
 * Map tab container: loads the trip's days/blocks, turns them into day-colored
 * pins plus chronological routes, and renders them with a day filter alongside
 * the Leaflet map.
 *
 * All Leaflet-specific rendering lives in `MapView` (loaded client-side only
 * through `@/components/map`), so this component stays plain React.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import type { ActivityCategory } from '@trip-planner/shared';
import {
  assignDayColors,
  buildRouteSegments,
  formatDistance,
  formatDuration,
  groupPinsByDay,
  toMapPins,
  withEstimatedDistances,
  type BlockLike,
  type MapPin,
} from '@/lib/map-utils';
import { formatTime, timezoneAbbreviation } from '@/lib/format';
import { useSocket } from '@/hooks/useSocket';
import { MapView } from './index';
import { DayFilter, type DayFilterEntry } from './DayFilter';

interface ApiBlock {
  id: string;
  title: string;
  category: ActivityCategory;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface ApiDay {
  id: string;
  dayNumber: number;
  date: string;
  blocks: ApiBlock[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function TripMap() {
  const { data: session } = useSession();
  const params = useParams();
  const tripId = params.id as string;
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [days, setDays] = useState<ApiDay[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenDays, setHiddenDays] = useState<Set<number>>(new Set());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // ─── Data ────────────────────────────────────────────────────────────────

  const fetchDays = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}/days`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load map data');
      const data = await res.json();
      setDays(data.days ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, [token, tripId]);

  const fetchTrip = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTimezone(data.trip?.timezone ?? null);
      }
    } catch {
      /* non-critical: times just render without a tz suffix */
    }
  }, [token, tripId]);

  useEffect(() => {
    fetchDays();
    fetchTrip();
  }, [fetchDays, fetchTrip]);

  // Keep pins in sync when collaborators change blocks while the map is open.
  const { socket } = useSocket({ tripId, token });
  useEffect(() => {
    if (!socket) return;
    const refetch = () => fetchDays();
    const events = ['block:created', 'block:updated', 'block:moved', 'block:deleted'];
    events.forEach((event) => socket.on(event, refetch));
    return () => events.forEach((event) => socket.off(event, refetch));
  }, [socket, fetchDays]);

  // ─── Derived map data ────────────────────────────────────────────────────

  const tzAbbrev = useMemo(() => timezoneAbbreviation(timezone), [timezone]);

  /** Every geo-located block across the trip, flattened into pins. */
  const allPins = useMemo(() => {
    const blocks: BlockLike[] = days.flatMap((day) =>
      day.blocks.map((block) => ({
        id: block.id,
        title: block.title,
        category: block.category,
        latitude: block.latitude,
        longitude: block.longitude,
        startTime: block.startTime,
        endTime: block.endTime,
        dayNumber: day.dayNumber,
      }))
    );
    return toMapPins(blocks);
  }, [days]);

  const totalBlocks = useMemo(
    () => days.reduce((sum, day) => sum + day.blocks.length, 0),
    [days]
  );
  const missingLocationCount = totalBlocks - allPins.length;

  /**
   * Colors are keyed by the highest day number rather than the day count, so
   * every day still gets a color if the numbering has gaps.
   */
  const dayColors = useMemo(
    () => assignDayColors(days.reduce((max, day) => Math.max(max, day.dayNumber), 0)),
    [days]
  );

  /** Only days that actually have pins get a filter row. */
  const filterEntries = useMemo<DayFilterEntry[]>(() => {
    const byDay = groupPinsByDay(allPins);
    return [...byDay.entries()].map(([dayNumber, dayPins]) => ({
      dayNumber,
      color: dayColors.get(dayNumber) ?? '#4363d8',
      pinCount: dayPins.length,
    }));
  }, [allPins, dayColors]);

  const visibleDays = useMemo(
    () => new Set(filterEntries.map((d) => d.dayNumber).filter((n) => !hiddenDays.has(n))),
    [filterEntries, hiddenDays]
  );

  const visiblePins = useMemo(
    () => allPins.filter((pin) => visibleDays.has(pin.dayNumber)),
    [allPins, visibleDays]
  );

  /** Routes are built from the visible pins so hidden days drop their lines. */
  const routes = useMemo(
    () => withEstimatedDistances(buildRouteSegments(visiblePins)),
    [visiblePins]
  );

  /**
   * Resolved from the pin list rather than stored directly, so the selection
   * survives (or clears) correctly when blocks change under real-time updates.
   */
  const selectedPin = useMemo<MapPin | null>(
    () => visiblePins.find((pin) => pin.blockId === selectedBlockId) ?? null,
    [visiblePins, selectedBlockId]
  );

  const handlePinClick = useCallback((pin: MapPin) => setSelectedBlockId(pin.blockId), []);

  /** Leg leaving the selected pin, for the "next stop" distance readout. */
  const selectedLeg = useMemo(
    () => (selectedPin ? routes.find((s) => s.from.blockId === selectedPin.blockId) ?? null : null),
    [routes, selectedPin]
  );

  /** Straight-line distance walked per visible day, for the side summary. */
  const dayDistances = useMemo(() => {
    const totals = new Map<number, number>();
    for (const segment of routes) {
      const day = segment.from.dayNumber;
      totals.set(day, (totals.get(day) ?? 0) + (segment.distance ?? 0));
    }
    return totals;
  }, [routes]);

  // ─── Filter handlers ─────────────────────────────────────────────────────

  const toggleDay = useCallback((dayNumber: number) => {
    setHiddenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  }, []);

  const showAllDays = useCallback(() => setHiddenDays(new Set()), []);
  const hideAllDays = useCallback(
    () => setHiddenDays(new Set(filterEntries.map((d) => d.dayNumber))),
    [filterEntries]
  );

  const itineraryHref = useCallback(
    (blockId: string) => `/trip/${tripId}?block=${blockId}`,
    [tripId]
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <aside className="space-y-4">
        <DayFilter
          days={filterEntries}
          visibleDays={visibleDays}
          onToggleDay={toggleDay}
          onShowAll={showAllDays}
          onShowNone={hideAllDays}
        />

        {selectedPin && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{selectedPin.title}</h3>
              <button
                type="button"
                onClick={() => setSelectedBlockId(null)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Day {selectedPin.dayNumber}
              {selectedPin.startTime ? ` · ${formatTime(selectedPin.startTime, tzAbbrev)}` : ''} ·{' '}
              <span className="capitalize">{selectedPin.category}</span>
            </p>
            {selectedLeg && (
              <p className="mt-1 text-xs text-gray-600">
                ~{formatDistance(selectedLeg.distance)}
                {selectedLeg.duration ? ` · ${formatDuration(selectedLeg.duration)}` : ''} to{' '}
                {selectedLeg.to.title}
              </p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Route estimate</h3>
          {dayDistances.size === 0 ? (
            <p className="text-xs text-gray-500">
              Add two or more located activities in a day to see route distances.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-gray-600">
              {[...dayDistances.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([dayNumber, meters]) => (
                  <li key={dayNumber} className="flex items-center justify-between">
                    <span>Day {dayNumber}</span>
                    <span className="font-medium text-gray-900">~{formatDistance(meters)}</span>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-gray-400">
            Straight-line (haversine) estimates, not driving directions.
          </p>
        </div>

        {missingLocationCount > 0 && (
          <p className="text-xs text-gray-500">
            {missingLocationCount} {missingLocationCount === 1 ? 'activity has' : 'activities have'}{' '}
            no location yet, so {missingLocationCount === 1 ? 'it is' : 'they are'} not on the map.
          </p>
        )}
      </aside>

      <div className="relative h-[32rem] overflow-hidden rounded-xl border border-gray-200 bg-white lg:h-[36rem]">
        <MapView
          pins={visiblePins}
          routes={routes}
          dayColors={dayColors}
          onPinClick={handlePinClick}
          selectedBlockId={selectedBlockId}
          itineraryHref={itineraryHref}
          tzAbbrev={tzAbbrev}
          autoFit
        />

        {allPins.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/70 p-6 text-center">
            <p className="max-w-xs text-sm text-gray-600">
              No activities have coordinates yet. Add a location to an activity and its pin will
              show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TripMap;
