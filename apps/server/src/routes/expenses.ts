import { Router, Request, Response, RequestHandler } from 'express';
import { requireRole, requireMember } from '../middleware/rbac.js';
import {
  validate,
  createExpenseSchema,
  updateExpenseSchema,
  recordSettlementSchema,
} from '../validation/schemas.js';
import {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  recordSettlement,
  getSettlements,
  getTripSummary,
} from '../services/expense.service.js';
import { ErrorCodes } from '@trip-planner/shared';

// ─── Trip-scoped expense routes (mounted on /api/trips/:id/expenses) ─────────

export const tripExpenseRoutes = Router({ mergeParams: true });

// The parent trips router already applies `authenticate`.

/**
 * POST /api/trips/:id/expenses
 * Create an expense with calculated splits. Editor or Owner role required.
 */
tripExpenseRoutes.post(
  '/',
  requireRole('owner', 'editor') as RequestHandler,
  validate(createExpenseSchema) as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;

      const result = await createExpense(tripId, req.body);

      if ('error' in result) {
        if (result.error === ErrorCodes.EXPENSE_PERCENTAGES_INVALID) {
          res.status(400).json({
            code: ErrorCodes.EXPENSE_PERCENTAGES_INVALID,
            message: 'Percentages must sum to 100',
          });
          return;
        }
        res.status(400).json({
          code: ErrorCodes.EXPENSE_INVALID_SPLIT,
          message: 'Owed and paid shares must each sum to the expense total',
        });
        return;
      }

      res.status(201).json({ expense: result.expense, splits: result.splits });
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * GET /api/trips/:id/expenses
 * List all expenses (with splits) for a trip. Member role required.
 */
tripExpenseRoutes.get(
  '/',
  requireMember() as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;

      const expenses = await getExpenses(tripId);
      res.status(200).json({ expenses });
    } catch (error) {
      console.error('List expenses error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * PUT /api/trips/:id/expenses/:expenseId
 * Edit an expense: recompute splits and balances, log the edit. Editor or
 * Owner role required. The expense must belong to the trip in the URL.
 */
tripExpenseRoutes.put(
  '/:expenseId',
  requireRole('owner', 'editor') as RequestHandler,
  validate(updateExpenseSchema) as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;
      const expenseId = req.params.expenseId as string;
      const actorId = req.auth?.userId;

      const result = await updateExpense(expenseId, { ...req.body, actorId }, tripId);

      if (result === null) {
        res.status(404).json({
          code: 'EXPENSE_NOT_FOUND',
          message: 'Expense not found',
        });
        return;
      }

      if ('error' in result) {
        if (result.error === ErrorCodes.EXPENSE_PERCENTAGES_INVALID) {
          res.status(400).json({
            code: ErrorCodes.EXPENSE_PERCENTAGES_INVALID,
            message: 'Percentages must sum to 100',
          });
          return;
        }
        res.status(400).json({
          code: ErrorCodes.EXPENSE_INVALID_SPLIT,
          message: 'Owed and paid shares must each sum to the expense total',
        });
        return;
      }

      res.status(200).json({ expense: result.expense, splits: result.splits });
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * DELETE /api/trips/:id/expenses/:expenseId
 * Soft-delete an expense so it is excluded from totals and balances. Editor or
 * Owner role required. The expense must belong to the trip in the URL.
 */
tripExpenseRoutes.delete(
  '/:expenseId',
  requireRole('owner', 'editor') as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;
      const expenseId = req.params.expenseId as string;
      const actorId = req.auth?.userId;

      const deleted = await deleteExpense(expenseId, actorId, tripId);
      if (!deleted) {
        res.status(404).json({
          code: 'EXPENSE_NOT_FOUND',
          message: 'Expense not found',
        });
        return;
      }

      res.status(200).json({ expense: deleted });
    } catch (error) {
      console.error('Delete expense error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

// ─── Trip-scoped settlement routes (mounted on /api/trips/:id/settlements) ────

export const tripSettlementRoutes = Router({ mergeParams: true });

/**
 * GET /api/trips/:id/settlements
 * Return the trip's net balances plus recorded settlement payments. Member role.
 */
tripSettlementRoutes.get(
  '/',
  requireMember() as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;

      const [summary, settlements] = await Promise.all([
        getTripSummary(tripId),
        getSettlements(tripId),
      ]);

      res.status(200).json({ summary, settlements });
    } catch (error) {
      console.error('Get settlements error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);

/**
 * POST /api/trips/:id/settlements
 * Record a settlement payment between two members (supports partial
 * settlements). Editor or Owner role required.
 */
tripSettlementRoutes.post(
  '/',
  requireRole('owner', 'editor') as RequestHandler,
  validate(recordSettlementSchema) as RequestHandler,
  async (req: Request, res: Response) => {
    try {
      const tripId = req.params.id as string;
      const { fromUserId, toUserId, amountMinor, note } = req.body;

      const settlement = await recordSettlement(
        tripId,
        fromUserId,
        toUserId,
        amountMinor,
        note ?? null
      );

      res.status(201).json({ settlement });
    } catch (error) {
      console.error('Record settlement error:', error);
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  }
);


