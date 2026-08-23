import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activityLog, users } from '../db/schema.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActionType = 'created' | 'updated' | 'moved' | 'deleted' | 'voted' | 'resolved';
export type EntityType = 'activity_block' | 'vote' | 'expense' | 'trip_member';

export interface ActivityLogEntry {
  id: string;
  tripId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Service Methods ─────────────────────────────────────────────────────────

/**
 * Logs an action to the activity feed. Failures are caught and logged
 * to prevent blocking the main operation.
 */
export async function logAction(
  tripId: string,
  userId: string,
  action: ActionType,
  entityType: EntityType,
  entityId: string,
  metadata?: Record<string, unknown>
): Promise<ActivityLogEntry | null> {
  try {
    const [entry] = await db
      .insert(activityLog)
      .values({
        tripId,
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ?? null,
      })
      .returning();

    return entry as unknown as ActivityLogEntry;
  } catch (error) {
    console.error('Failed to log activity:', error);
    return null;
  }
}

/**
 * Gets recent activity log entries for a trip, ordered by createdAt DESC.
 */
export async function getRecentActions(
  tripId: string,
  limit = 20,
  offset = 0
): Promise<ActivityLogEntry[]> {
  const entries = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.tripId, tripId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);

  return entries as unknown as ActivityLogEntry[];
}

/**
 * Formats an activity log entry into a human-readable description.
 */
export function formatDescription(entry: ActivityLogEntry, userName: string): string {
  const metadata = entry.metadata ?? {};
  const entityName = (metadata.title as string) || entry.entityType;

  const templates: Record<ActionType, string> = {
    created: `${userName} added '${entityName}'`,
    updated: `${userName} updated '${entityName}'`,
    moved: `${userName} moved '${entityName}' from Day ${metadata.fromDay} to Day ${metadata.toDay}`,
    deleted: `${userName} removed '${entityName}'`,
    voted: `${userName} voted on '${entityName}'`,
    resolved: `${userName} resolved poll '${entityName}'`,
  };

  return templates[entry.action as ActionType] || `${userName} performed '${entry.action}' on '${entityName}'`;
}

/**
 * Gets recent activity feed entries for a trip with user names and formatted descriptions.
 */
export async function getActivityFeed(tripId: string, limit = 20, offset = 0) {
  const entries = await db
    .select({
      id: activityLog.id,
      tripId: activityLog.tripId,
      userId: activityLog.userId,
      action: activityLog.action,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      userName: users.name,
    })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.userId, users.id))
    .where(eq(activityLog.tripId, tripId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);

  return entries.map((entry) => {
    const logEntry: ActivityLogEntry = {
      id: entry.id,
      tripId: entry.tripId,
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata as Record<string, unknown> | null,
      createdAt: entry.createdAt,
    };

    return {
      ...logEntry,
      userName: entry.userName,
      description: formatDescription(logEntry, entry.userName),
    };
  });
}
