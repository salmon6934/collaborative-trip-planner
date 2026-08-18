import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications, tripMembers } from '../db/schema.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType = 'block_created' | 'block_moved' | 'block_deleted' | 'member_joined';

// ─── Service Methods ─────────────────────────────────────────────────────────

/**
 * Creates a notification for a specific user.
 */
export async function createNotification(
  tripId: string,
  userId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  const [notification] = await db
    .insert(notifications)
    .values({
      tripId,
      userId,
      type,
      title,
      message,
    })
    .returning();

  return notification;
}

/**
 * Creates notifications for all OTHER trip members (excluding the actor).
 * Returns the created notification records.
 */
export async function notifyTripMembers(
  tripId: string,
  excludeUserId: string,
  type: NotificationType,
  title: string,
  message: string
) {
  // Get all members of the trip except the actor
  const members = await db
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId)));

  const otherMembers = members.filter((m) => m.userId !== excludeUserId);

  if (otherMembers.length === 0) return [];

  const values = otherMembers.map((m) => ({
    tripId,
    userId: m.userId,
    type: type as any,
    title,
    message,
  }));

  const created = await db.insert(notifications).values(values).returning();
  return created;
}

/**
 * Gets the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result?.count ?? 0;
}

/**
 * Gets paginated notifications for a user, ordered by createdAt DESC.
 */
export async function getUserNotifications(userId: string, limit = 20, offset = 0) {
  const results = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

/**
 * Marks a single notification as read. Returns the updated notification or null.
 */
export async function markAsRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();

  return updated ?? null;
}

/**
 * Marks all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}
