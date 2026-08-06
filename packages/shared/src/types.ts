// User & Auth
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface Session {
  userId: string;
  token: string;
  expiresAt: Date;
}

// Trip
export type TripRole = 'owner' | 'editor' | 'viewer';

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  createdBy: string;
  inviteCode: string;
  createdAt: Date;
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: TripRole;
  joinedAt: Date;
}

export interface CreateTripInput {
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
}

// Itinerary
export type ActivityCategory = 'food' | 'travel' | 'stay' | 'activity';

export interface Day {
  id: string;
  tripId: string;
  date: Date;
  dayNumber: number;
}

export interface ActivityBlock {
  id: string;
  dayId: string;
  tripId: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  estimatedCost: number | null;
  currency: string;
  position: number;
  createdBy: string;
  updatedAt: Date;
}

export interface MoveBlockInput {
  blockId: string;
  targetDayId: string;
  targetPosition: number;
}

// Presence
export interface PresenceInfo {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  currentDay: number | null;
  editingBlockId: string | null;
  lastHeartbeat: Date;
}

export type PresenceEvent =
  | { type: 'presence:join'; userId: string; tripId: string }
  | { type: 'presence:leave'; userId: string; tripId: string }
  | { type: 'presence:cursor'; userId: string; tripId: string; dayNumber: number }
  | { type: 'presence:editing'; userId: string; tripId: string; blockId: string | null };

// Voting
export interface Vote {
  id: string;
  tripId: string;
  question: string;
  createdBy: string;
  isResolved: boolean;
  winningOptionId: string | null;
  createdAt: Date;
}

export interface VoteOption {
  id: string;
  voteId: string;
  title: string;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
}

export interface VoteResponse {
  id: string;
  voteId: string;
  optionId: string;
  userId: string;
  createdAt: Date;
}

export interface VoteTally {
  optionId: string;
  count: number;
}

// Expenses
export type SplitType = 'equal' | 'custom' | 'percentage';

export interface Expense {
  id: string;
  tripId: string;
  activityBlockId: string | null;
  title: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitType: SplitType;
  createdAt: Date;
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amountOwed: number;
  isSettled: boolean;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
  currency: string;
}

export interface TripExpenseSummary {
  totalCost: number;
  memberShares: { userId: string; share: number }[];
  settlements: SettlementTransaction[];
}

// Activity Feed
export type ActionType = 'created' | 'updated' | 'moved' | 'deleted' | 'voted' | 'resolved';
export type EntityType = 'activity_block' | 'vote' | 'expense' | 'trip_member';

export interface ActivityLogEntry {
  id: string;
  tripId: string;
  userId: string;
  action: ActionType;
  entityType: EntityType;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// API Error
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Socket.io Event Map
export interface SocketEventMap {
  // Itinerary events
  'block:created': { block: ActivityBlock };
  'block:updated': { block: ActivityBlock; updatedFields: string[] };
  'block:moved': { block: ActivityBlock; fromDayId: string; toDayId: string };
  'block:deleted': { blockId: string; dayId: string };

  // Voting events
  'vote:created': { vote: Vote; options: VoteOption[] };
  'vote:cast': { voteId: string; tallies: VoteTally[] };
  'vote:resolved': { vote: Vote };

  // Presence events
  'presence:join': { userId: string; userName: string; avatarUrl: string | null };
  'presence:leave': { userId: string };
  'presence:cursor': { userId: string; dayNumber: number };
  'presence:editing': { userId: string; blockId: string | null };

  // Expense events
  'expense:created': { expense: Expense; splits: ExpenseSplit[] };
  'expense:settled': { splitId: string };
}
