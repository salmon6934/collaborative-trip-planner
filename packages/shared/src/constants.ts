// Error codes for the API
export const ErrorCodes = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  TRIP_NOT_FOUND: 'TRIP_NOT_FOUND',
  TRIP_PERMISSION_DENIED: 'TRIP_PERMISSION_DENIED',
  INVITE_CODE_INVALID: 'INVITE_CODE_INVALID',
  MEMBER_ALREADY_EXISTS: 'MEMBER_ALREADY_EXISTS',
  BLOCK_NOT_FOUND: 'BLOCK_NOT_FOUND',
  BLOCK_INVALID_CATEGORY: 'BLOCK_INVALID_CATEGORY',
  VOTE_ALREADY_CAST: 'VOTE_ALREADY_CAST',
  VOTE_POLL_RESOLVED: 'VOTE_POLL_RESOLVED',
  VOTE_INSUFFICIENT_OPTIONS: 'VOTE_INSUFFICIENT_OPTIONS',
  EXPENSE_INVALID_SPLIT: 'EXPENSE_INVALID_SPLIT',
  EXPENSE_PERCENTAGES_INVALID: 'EXPENSE_PERCENTAGES_INVALID',
} as const;

// Activity block category enum values
export const ActivityCategories = ['food', 'travel', 'stay', 'activity'] as const;

// Trip role enum values
export const TripRoles = ['owner', 'editor', 'viewer'] as const;

// Split type enum values
export const SplitTypes = ['equal', 'custom', 'percentage'] as const;

// Action type enum values for activity feed
export const ActionTypes = ['created', 'updated', 'moved', 'deleted', 'voted', 'resolved'] as const;

// Entity type enum values for activity feed
export const EntityTypes = ['activity_block', 'vote', 'expense', 'trip_member'] as const;
