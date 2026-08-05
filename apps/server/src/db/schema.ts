import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  integer,
  real,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'), // null for OAuth-only users
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Trips ───────────────────────────────────────────────────────────────────

export const trips = pgTable('trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  destination: text('destination').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  inviteCode: text('invite_code').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Trip Members ────────────────────────────────────────────────────────────

export const tripMembers = pgTable('trip_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ─── Days ────────────────────────────────────────────────────────────────────

export const days = pgTable('days', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  date: date('date').notNull(),
  dayNumber: integer('day_number').notNull(),
});

// ─── Activity Blocks ─────────────────────────────────────────────────────────

export const activityBlocks = pgTable('activity_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayId: uuid('day_id')
    .references(() => days.id, { onDelete: 'cascade' })
    .notNull(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category', {
    enum: ['food', 'travel', 'stay', 'activity'],
  }).notNull(),
  startTime: text('start_time'), // HH:mm format
  endTime: text('end_time'),
  locationName: text('location_name'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  estimatedCost: real('estimated_cost'),
  currency: text('currency').default('INR'),
  position: real('position').notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Votes ───────────────────────────────────────────────────────────────────

export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  question: text('question').notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id)
    .notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  winningOptionId: uuid('winning_option_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Vote Options ────────────────────────────────────────────────────────────

export const voteOptions = pgTable('vote_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  voteId: uuid('vote_id')
    .references(() => votes.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  description: text('description'),
  link: text('link'),
  imageUrl: text('image_url'),
});

// ─── Vote Responses ──────────────────────────────────────────────────────────

export const voteResponses = pgTable('vote_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  voteId: uuid('vote_id')
    .references(() => votes.id, { onDelete: 'cascade' })
    .notNull(),
  optionId: uuid('option_id')
    .references(() => voteOptions.id)
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Expenses ────────────────────────────────────────────────────────────────

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  activityBlockId: uuid('activity_block_id').references(
    () => activityBlocks.id
  ),
  title: text('title').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').default('INR').notNull(),
  paidBy: uuid('paid_by')
    .references(() => users.id)
    .notNull(),
  splitType: text('split_type', {
    enum: ['equal', 'custom', 'percentage'],
  }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Expense Splits ──────────────────────────────────────────────────────────

export const expenseSplits = pgTable('expense_splits', {
  id: uuid('id').primaryKey().defaultRandom(),
  expenseId: uuid('expense_id')
    .references(() => expenses.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  amountOwed: real('amount_owed').notNull(),
  isSettled: boolean('is_settled').default(false).notNull(),
});

// ─── Activity Log ────────────────────────────────────────────────────────────

export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id')
    .references(() => trips.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
