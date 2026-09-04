'use client';

/**
 * Leaflet-backed map that renders itinerary pins colored by day and draws
 * chronological route lines within each day.
 *
 * NOTE: Leaflet touches `window` at import time, so this component must only be
 * rendered on the client. Import it through `@/components/map` (which wraps it
 * in a `dynamic(..., { ssr: false })` boundary) rather than importing this file
 * directly from a server component.
 */

import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import type { MapPin, RouteSegment } from '@/lib/map-utils';
import { computePinsCenter } from '@/lib/map-utils';

export type { MapPin, RouteSegment } from '@/lib/map-utils';

export interface MapViewProps {
  pins: MapPin[];
  routes: RouteSegment[];
  /** Map of dayNumber -> "#rrggbb" hex color. */
  dayColors: Map<number, string>;
  onPinClick: (blockId: string) => void;
  /**
   * Initial center [lat, lng], typically the trip destination. When omitted,
   * the center is derived from the pins, falling back to a world view.
   */
  center?: [number, number];
  /** Initial zoom level. Defaults to 13 (city-level). */
  zoom?: number;
  className?: string;
}

/** Fallback center when there are neither pins nor a destination (mid-world). */
const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 13;
const FALLBACK_COLOR = '#4363d8';

/**
 * Keeps the Leaflet view in sync when the resolved center changes (e.g. after
 * the destination geocodes or pins load in).
 */
function RecenterOnChange({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]);
  return null;
}

export function MapView({
  pins,
  routes,
  dayColors,
  onPinClick,
  center,
  zoom = DEFAULT_ZOOM,
  className,
}: MapViewProps) {
  const resolvedCenter = center ?? computePinsCenter(pins) ?? DEFAULT_CENTER;
  const hasFocus = center != null || pins.length > 0;
  const resolvedZoom = hasFocus ? zoom : 2;

  return (
    <MapContainer
      center={resolvedCenter}
      zoom={resolvedZoom}
      scrollWheelZoom
      className={className ?? 'h-full w-full'}
      style={className ? undefined : { height: '100%', width: '100%' }}
    >
      <RecenterOnChange center={resolvedCenter} zoom={resolvedZoom} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {routes.map((segment) => {
        const color = dayColors.get(segment.from.dayNumber) ?? FALLBACK_COLOR;
        return (
          <Polyline
            key={`route-${segment.from.blockId}-${segment.to.blockId}`}
            positions={[
              [segment.from.latitude, segment.from.longitude],
              [segment.to.latitude, segment.to.longitude],
            ]}
            pathOptions={{ color, weight: 3, opacity: 0.7 }}
          />
        );
      })}

      {pins.map((pin) => {
        const color = dayColors.get(pin.dayNumber) ?? FALLBACK_COLOR;
        return (
          <CircleMarker
            key={`pin-${pin.blockId}`}
            center={[pin.latitude, pin.longitude]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onPinClick(pin.blockId) }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{pin.title}</p>
                <p className="text-gray-500">
                  Day {pin.dayNumber}
                  {pin.startTime ? ` · ${pin.startTime}` : ''}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}

export default MapView;
