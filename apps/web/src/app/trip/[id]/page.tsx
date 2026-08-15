'use client';

import { ItineraryBoard } from '@/components/itinerary/ItineraryBoard';

export default function TripItineraryPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Itinerary</h2>
        <p className="mt-1 text-sm text-gray-600">
          Drag and drop activities to plan your trip day by day.
        </p>
      </div>
      <ItineraryBoard />
    </div>
  );
}
