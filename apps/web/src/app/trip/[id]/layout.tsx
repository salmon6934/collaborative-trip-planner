'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserMenu } from '@/components/UserMenu';
import { NotificationBell } from '@/components/NotificationBell';
import { MembersPanel, MembersButton, MemberWithStatus } from '@/components/presence/OnlineAvatars';
import { usePresence } from '@/hooks/usePresence';
import { useSocket } from '@/hooks/useSocket';

const tabs = [
  { name: 'Itinerary', href: '' },
  { name: 'Map', href: '/map' },
  { name: 'Votes', href: '/votes' },
  { name: 'Expenses', href: '/expenses' },
  { name: 'Settings', href: '/settings' },
];

interface TripMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const params = useParams();
  const pathname = usePathname();
  const tripId = params.id as string;
  const basePath = `/trip/${tripId}`;
  const token = (session as any)?.accessToken as string | undefined;
  const currentUserId = (session as any)?.user?.id as string | undefined;

  const [membersOpen, setMembersOpen] = useState(false);
  const [tripMembers, setTripMembers] = useState<TripMember[]>([]);

  // Socket connection for presence (shared across all tabs)
  const { socket } = useSocket({ tripId, token });

  // Online presence tracking
  const { onlineMembers } = usePresence({ socket, tripId, currentUserId });

  // Fetch all trip members from REST API
  const fetchMembers = useCallback(async () => {
    if (!token || !tripId) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${API_URL}/api/trips/${tripId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTripMembers(data.members || []);
      }
    } catch (err) {
      // Silently fail — members panel is non-critical
    }
  }, [token, tripId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Merge trip members with online status
  const onlineUserIds = new Set(onlineMembers.map((m) => m.userId));
  const editingUserIds = new Set(
    onlineMembers.filter((m) => m.editingBlockId !== null).map((m) => m.userId)
  );
  const membersWithStatus: MemberWithStatus[] = tripMembers.map((m) => ({
    userId: m.userId,
    userName: m.user.name,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
    isOnline: onlineUserIds.has(m.userId),
    isEditing: editingUserIds.has(m.userId),
  }));

  // Sort: online first, then alphabetical
  membersWithStatus.sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return a.userName.localeCompare(b.userName);
  });

  const onlineCount = membersWithStatus.filter((m) => m.isOnline).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition"
              title="Back to dashboard"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <Link href="/dashboard" className="text-xl font-bold text-indigo-600">
              Trip Planner
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <MembersButton
              onlineCount={onlineCount}
              onClick={() => setMembersOpen((prev) => !prev)}
            />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const tabHref = `${basePath}${tab.href}`;
              const isActive =
                tab.href === ''
                  ? pathname === basePath || pathname === `${basePath}/itinerary`
                  : pathname.startsWith(tabHref);

              return (
                <Link
                  key={tab.name}
                  href={tab.href === '' ? basePath : tabHref}
                  className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Members slide-in panel (visible across all tabs) */}
      <MembersPanel
        members={membersWithStatus}
        isOpen={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    </div>
  );
}
