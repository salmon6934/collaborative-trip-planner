/**
 * Public entry point for the map feature.
 *
 * Leaflet cannot run during server-side rendering, so the map component is
 * exposed here wrapped in a `dynamic(..., { ssr: false })` boundary. Consumers
 * should import `MapView` from `@/components/map` rather than from
 * `./MapView` directly.
 */

'use client';

import dynamic from 'next/dynamic';

export type { MapViewProps } from './MapView';
export type { MapPin, RouteSegment } from '@/lib/map-utils';

export const MapView = dynamic(() => import('./MapView').then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
      Loading map…
    </div>
  ),
});
