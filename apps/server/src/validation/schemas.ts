import { z } from 'zod';

// Reusable base schemas
export const uuidSchema = z.string().uuid();
export const emailSchema = z.string().email();
export const dateSchema = z.coerce.date();

// Auth schemas
export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Trip schemas
export const createTripSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  destination: z.string().min(1, 'Destination is required').max(200),
  startDate: dateSchema,
  endDate: dateSchema,
}).refine((data) => data.endDate >= data.startDate, {
  message: 'End date must be on or after start date',
  path: ['endDate'],
});

export const updateTripSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(200).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
});

// Activity block schemas
export const activityCategorySchema = z.enum(['food', 'travel', 'stay', 'activity']);

export const createBlockSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  category: activityCategorySchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').nullable().optional(),
  locationName: z.string().max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  estimatedCost: z.number().min(0).nullable().optional(),
  currency: z.string().length(3).default('INR'),
  dayId: uuidSchema,
});

export const updateBlockSchema = createBlockSchema.partial().omit({ dayId: true });

export const moveBlockSchema = z.object({
  blockId: uuidSchema,
  targetDayId: uuidSchema,
  targetPosition: z.number().min(0),
});

export const reorderBlocksSchema = z.object({
  dayId: uuidSchema,
  blockIds: z.array(uuidSchema).min(1),
});

// Vote schemas
export const createVoteOptionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  link: z.string().url().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export const createVoteSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  options: z.array(createVoteOptionSchema).min(2, 'At least two options are required'),
});

export const castVoteSchema = z.object({
  optionId: uuidSchema,
});

// Expense schemas
export const splitTypeSchema = z.enum(['equal', 'custom', 'percentage']);

export const customSplitSchema = z.object({
  userId: uuidSchema,
  amount: z.number().min(0),
});

export const percentageSplitSchema = z.object({
  userId: uuidSchema,
  percentage: z.number().min(0).max(100),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('INR'),
  paidBy: uuidSchema,
  splitType: splitTypeSchema,
  activityBlockId: uuidSchema.nullable().optional(),
  customSplits: z.array(customSplitSchema).optional(),
  percentageSplits: z.array(percentageSplitSchema).optional(),
});

// Trip join & member role schemas
export const joinTripSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['editor', 'viewer']),
});

// Validation helper middleware
export function validate<T extends z.ZodType>(schema: T) {
  return (req: any, res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}
