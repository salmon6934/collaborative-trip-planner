'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { UserMenu } from '@/components/UserMenu';
import { NotificationBell } from '@/components/NotificationBell';

const tabs = [
  { name: 'Itinerary', href: '' },
  { name: 'Map', href: '/map' },
  { name: 'Votes', href: '/votes' },
  { name: 'Expenses', href: '/expenses' },
  { name: 'Settings', href: '/settings' },
];

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const tripId = params.id as string;
  const basePath = `/trip/${tripId}`;

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
              // Active if the pathname matches exactly (for root) or starts with the tab path
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
    </div>
  );
}
