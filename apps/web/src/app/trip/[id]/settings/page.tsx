'use client';

import { useState, useEffect } from 'react';
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
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(true);

  useEffect(() => {
    async function fetchTrip() {
      if (!token) return;
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const res = await fetch(`${API_URL}/api/trips/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInviteCode(data.trip.inviteCode);
        }
      } catch {
        // Silently fail — invite code just won't show
      } finally {
        setLoadingTrip(false);
      }
    }
    fetchTrip();
  }, [token, tripId]);

  async function handleCopyInviteCode() {
    const inviteLink = `${window.location.origin}/join/${inviteCode}`;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyCode() {
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      {/* Invite Section */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Invite Members</h3>
        <p className="mt-1 text-sm text-gray-600">
          Share the invite code or link below. Anyone with this code can join as an Editor.
        </p>

        {loadingTrip ? (
          <div className="mt-4 h-10 w-48 animate-pulse rounded-lg bg-gray-100" />
        ) : inviteCode ? (
          <div className="mt-4 space-y-3">
            {/* Invite code display */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm font-medium text-gray-900 select-all">
                {inviteCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>

            {/* Copy full link */}
            <button
              onClick={handleCopyInviteCode}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {copied ? 'Copied!' : 'Copy Invite Link'}
            </button>

            <p className="text-xs text-gray-500">
              Link format: {typeof window !== 'undefined' ? window.location.origin : ''}/join/{inviteCode}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500">Unable to load invite code.</p>
        )}
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
