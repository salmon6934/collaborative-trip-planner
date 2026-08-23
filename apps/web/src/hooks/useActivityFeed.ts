'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const PAGE_SIZE = 20;

export interface ActivityEntry {
  id: string;
  tripId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string;
  description: string;
}

interface UseActivityFeedOptions {
  tripId: string;
  token: string | undefined;
  socket: Socket | null;
  currentUserId: string | undefined;
}

/**
 * Custom hook for the activity feed.
 * Fetches paginated activity entries, listens to socket events for real-time updates,
 * shows toasts for other users' actions, and tracks unread count via localStorage.
 */
export function useActivityFeed({ tripId, token, socket, currentUserId }: UseActivityFeedOptions) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const offsetRef = useRef(0);

  const lastSeenKey = `activity_feed_last_seen:${tripId}`;

  // Get last seen timestamp from localStorage
  const getLastSeen = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(lastSeenKey);
    return stored ? parseInt(stored, 10) : 0;
  }, [lastSeenKey]);

  // Compute unread count based on last seen timestamp
  const computeUnread = useCallback(
    (entries: ActivityEntry[]) => {
      const lastSeen = getLastSeen();
      if (!lastSeen) {
        setUnreadCount(0);
        return;
      }
      const count = entries.filter(
        (e) => new Date(e.createdAt).getTime() > lastSeen
      ).length;
      setUnreadCount(count);
    },
    [getLastSeen]
  );

  // Mark activity feed as seen (updates localStorage + resets unread)
  const markAsSeen = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(lastSeenKey, String(Date.now()));
    setUnreadCount(0);
  }, [lastSeenKey]);

  // Fetch activity feed from API
  const fetchActivities = useCallback(
    async (offset = 0) => {
      if (!token || !tripId) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/api/trips/${tripId}/activity?limit=${PAGE_SIZE}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          const fetched: ActivityEntry[] = data.activities || [];
          if (offset === 0) {
            setActivities(fetched);
            computeUnread(fetched);
          } else {
            setActivities((prev) => {
              const merged = [...prev, ...fetched];
              computeUnread(merged);
              return merged;
            });
          }
          setHasMore(fetched.length === PAGE_SIZE);
          offsetRef.current = offset + fetched.length;
        }
      } catch {
        // Silently fail — activity feed is non-critical
      } finally {
        setLoading(false);
      }
    },
    [token, tripId, computeUnread]
  );

  // Load more (pagination)
  const loadMore = useCallback(() => {
    fetchActivities(offsetRef.current);
  }, [fetchActivities]);

  // Initial fetch
  useEffect(() => {
    offsetRef.current = 0;
    fetchActivities(0);
  }, [fetchActivities]);

  // Listen to socket events for real-time activity updates
  useEffect(() => {
    if (!socket) return;

    const events = [
      'block:created',
      'block:updated',
      'block:moved',
      'block:deleted',
      'vote:created',
      'vote:cast',
      'vote:resolved',
    ];

    function handleActivity(data: any) {
      // Build an ActivityEntry from the socket event data
      const entry: ActivityEntry = {
        id: data.id || `rt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tripId: data.tripId || tripId,
        userId: data.userId || '',
        action: data.action || '',
        entityType: data.entityType || '',
        entityId: data.entityId || '',
        metadata: data.metadata || null,
        createdAt: data.createdAt || new Date().toISOString(),
        userName: data.userName || 'Someone',
        description: data.description || `${data.userName || 'Someone'} made a change`,
      };

      // Prepend to the activity list
      setActivities((prev) => [entry, ...prev]);

      // If this is from another user, show a toast and increment unread
      if (entry.userId !== currentUserId) {
        toast(entry.description, { duration: 4000 });
        setUnreadCount((prev) => prev + 1);
      }
    }

    events.forEach((event) => {
      socket.on(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        socket.off(event, handleActivity);
      });
    };
  }, [socket, tripId, currentUserId]);

  return {
    activities,
    unreadCount,
    loading,
    loadMore,
    hasMore,
    markAsSeen,
  };
}
