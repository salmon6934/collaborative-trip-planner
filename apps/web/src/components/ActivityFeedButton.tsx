'use client';

interface ActivityFeedButtonProps {
  unreadCount: number;
  onClick: () => void;
}

/**
 * Button to toggle the activity feed panel. Shows a history/list icon
 * and an unread count badge when there are unseen activities.
 */
export function ActivityFeedButton({ unreadCount, onClick }: ActivityFeedButtonProps) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground shadow-sm hover:bg-muted transition"
      aria-label="Toggle activity feed"
      title="Activity feed"
    >
      {/* History/clock icon */}
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
