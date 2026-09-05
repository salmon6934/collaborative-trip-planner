'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { useGeocodeSearch, type GeocodeResult } from '@/hooks/useGeocodeSearch';

/**
 * Location field with debounced geocoding autocomplete.
 *
 * Holds three related values that must stay consistent: the human-readable
 * `locationName` and the `latitude`/`longitude` that put the activity on the
 * map. Picking a suggestion sets all three at once.
 *
 * Typing by hand deliberately does *not* clear existing coordinates — people
 * relabel a pinned place ("Hotel" -> "Hotel (check-in 3pm)") far more often
 * than they mean to unpin it. The coordinate chip has an explicit remove
 * button for that.
 */

export interface LocationValue {
  locationName: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationSearchInputProps {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  token: string | undefined;
  /** Biases results toward the trip's destination. */
  tripId?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Rough icon hint from the OSM class/type pair. */
function resultIcon(result: GeocodeResult): string {
  const key = `${result.category ?? ''}:${result.type ?? ''}`;
  if (key.includes('restaurant') || key.includes('cafe') || key.includes('fast_food')) return '🍽️';
  if (key.includes('hotel') || key.includes('hostel') || key.includes('guest_house')) return '🏨';
  if (key.includes('airport') || key.includes('aerodrome')) return '✈️';
  if (key.includes('station') || key.includes('railway') || key.includes('bus')) return '🚉';
  if (result.category === 'tourism' || key.includes('attraction') || key.includes('museum')) return '🎯';
  if (result.category === 'natural' || key.includes('park') || key.includes('beach')) return '🌳';
  if (result.category === 'place' || key.includes('city') || key.includes('town')) return '🏙️';
  return '📍';
}

/** "Tokyo Tower" plus the rest of the address on a second line. */
function splitLabel(result: GeocodeResult): { primary: string; secondary: string } {
  const primary = result.name;
  const secondary = result.displayName.startsWith(primary)
    ? result.displayName.slice(primary.length).replace(/^,\s*/, '')
    : result.displayName;
  return { primary, secondary };
}

export function LocationSearchInput({
  value,
  onChange,
  token,
  tripId,
  id,
  placeholder = 'Search a place, e.g. Tokyo Tower',
  disabled = false,
}: LocationSearchInputProps) {
  const generatedId = useId();
  const inputId = id ?? `location-${generatedId}`;
  const listboxId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  /**
   * Suppresses searching until the user actually types. Without this, opening
   * the edit modal on a block that already has a location would fire a request
   * for a value the user never touched.
   */
  const [dirty, setDirty] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const { results, loading, error, searched, tooShort } = useGeocodeSearch({
    query: value.locationName,
    token,
    tripId,
    enabled: dirty && open,
  });

  const hasCoordinates = value.latitude != null && value.longitude != null;

  // Reset the highlight whenever the result set changes so the arrow keys
  // don't point at a stale row.
  useEffect(() => setActiveIndex(-1), [results]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  function handleTextChange(text: string) {
    setDirty(true);
    setOpen(true);
    // Coordinates intentionally preserved — see the component doc comment.
    onChange({ ...value, locationName: text });
  }

  function selectResult(result: GeocodeResult) {
    onChange({
      locationName: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    });
    // Collapse and stop searching, otherwise the just-applied name would
    // immediately trigger a fresh lookup for itself.
    setOpen(false);
    setDirty(false);
    setActiveIndex(-1);
  }

  function clearCoordinates() {
    onChange({ ...value, latitude: null, longitude: null });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return;
      // Don't let the caret jump to either end of the text while navigating.
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = prev + delta;
        if (next < 0) return results.length - 1;
        if (next >= results.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === 'Enter' && open && activeIndex >= 0 && results[activeIndex]) {
      // Selecting a suggestion must not submit the surrounding form.
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  const showDropdown = open && dirty && !tooShort;
  const showNoMatches = showDropdown && !loading && !error && searched && results.length === 0;

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        Location
      </label>

      <div className="relative mt-1">
        <input
          id={inputId}
          type="text"
          value={value.locationName}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-9 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && results[activeIndex]
              ? `${listboxId}-option-${results[activeIndex].placeId}`
              : undefined
          }
          aria-describedby={`${inputId}-hint`}
        />

        {loading && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2"
            role="status"
            aria-label="Searching locations"
          >
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </span>
        )}
      </div>

      {/* Coordinate state: the thing that decides whether a pin appears. */}
      <div id={`${inputId}-hint`} className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
        {hasCoordinates ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">
              <span aria-hidden="true">📍</span>
              Pinned {value.latitude!.toFixed(4)}, {value.longitude!.toFixed(4)}
            </span>
            <button
              type="button"
              onClick={clearCoordinates}
              className="font-medium text-gray-500 underline hover:text-gray-700"
            >
              Remove pin
            </button>
          </>
        ) : (
          <span className="text-gray-500">
            {value.locationName.trim()
              ? 'No coordinates yet — pick a search result to place this on the map.'
              : 'Search for a place to add it to the map.'}
          </span>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {showDropdown && (results.length > 0 || showNoMatches) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <ul id={listboxId} role="listbox" aria-label="Location suggestions" className="max-h-60 overflow-y-auto">
            {results.map((result, index) => {
              const { primary, secondary } = splitLabel(result);
              return (
                <li
                  key={result.placeId}
                  id={`${listboxId}-option-${result.placeId}`}
                  role="option"
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    // onMouseDown, not onClick: the input's blur would otherwise
                    // close the dropdown before the click landed.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectResult(result);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${
                      index === activeIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span aria-hidden="true" className="mt-0.5">
                      {resultIcon(result)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{primary}</span>
                      {secondary && (
                        <span className="block truncate text-xs text-gray-500">{secondary}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {showNoMatches && (
            <p className="px-3 py-2 text-xs text-gray-500">
              No places found. You can still type a location name — it just won&apos;t get a map pin.
            </p>
          )}

          {results.length > 0 && (
            <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
              Search by OpenStreetMap / Nominatim
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationSearchInput;
