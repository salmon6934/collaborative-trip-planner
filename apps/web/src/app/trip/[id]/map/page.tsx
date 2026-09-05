'use client';

import { TripMap } from '@/components/map/TripMap';

export default function TripMapPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">Map</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pins are colored by day, and route lines follow each day&apos;s schedule.
        </p>
      </div>
      <TripMap />
    </div>
  );
}
