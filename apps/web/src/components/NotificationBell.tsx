'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications, Notification } from '@/hooks/useNotifications';

/**
 * Formats a date string into a relative time string (e.g., "2m ago", "1h ago").
 */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Returns an icon/emoji for a notification type.
 */
function notificationIcon(type: Notification['type']): string {
  switch (type) {
    case 'block_created':
      return '➕';
    case 'block_moved':
      return '↕️';
    case 'block_deleted':
      return '🗑️';
    case 'member_joined':
      return '👋';
    default:
      return '🔔';
  }
}

/**
 * NotificationBell component — bell icon with unread count badge and dropdown panel.
 * Shows recent notifications, allows marking as read, and navigating to relevant trips.
 */
export function NotificationBell() {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setOpen(false);
    router.push(`/trip/${notification.tripId}`);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition ${
                    !notification.isRead ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  {/* Icon */}
                  <span className="mt-0.5 text-base">{notificationIcon(notification.type)}</span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        !notification.isRead ? 'font-medium text-gray-900' : 'text-gray-700'
                      }`}
                    >
                      {notification.message}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {relativeTime(notification.createdAt)}
                    </p>
                  </div>

                  {/* Unread dot */}
                  {!notification.isRead && (
                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
