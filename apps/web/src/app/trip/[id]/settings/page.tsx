'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function TripSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const tripId = params.id as string;
  const token = (session as any)?.accessToken as string | undefined;

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!token) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this trip? This action cannot be undone. All days, activities, votes, and expenses will be permanently removed.'
    );
    if (!confirmed) return;

    setDeleting(true);
    setError('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete trip');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trip');
      setDeleting(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
      <p className="mt-2 text-sm text-gray-600">
        Manage trip details, members, and invite links.
      </p>

      <div className="mt-8 rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-gray-500">
          Trip settings and member management UI coming soon.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
        <p className="mt-1 text-sm text-red-700">
          Deleting a trip is permanent. All days, activities, votes, and expenses will be removed.
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</div>
        )}

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete This Trip'}
        </button>
      </div>
    </div>
  );
}
