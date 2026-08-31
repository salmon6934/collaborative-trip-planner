import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Chainable DB Mock ───────────────────────────────────────────────────────
//
// A single chainable query-builder mock: every builder method returns the same
// builder, and awaiting the builder resolves to the next queued result. Each
// db.insert/select/update/delete call starts a fresh builder. We record the
// arguments passed to `.values()` and `.set()` so tests can assert on them.

let resultQueue: any[] = [];
const valuesCalls: any[] = [];
const setCalls: any[] = [];

function makeBuilder() {
  const builder: any = {};
  const chain = ['from', 'where', 'limit', 'orderBy', 'offset', 'innerJoin', 'returning'];
  for (const m of chain) builder[m] = vi.fn(() => builder);
  builder.values = vi.fn((arg: any) => {
    valuesCalls.push(arg);
    return builder;
  });
  builder.set = vi.fn((arg: any) => {
    setCalls.push(arg);
    return builder;
  });
  builder.then = (resolve: any, reject: any) => {
    const next = resultQueue.length > 0 ? resultQueue.shift() : [];
    return Promise.resolve(next).then(resolve, reject);
  };
  return builder;
}

const mockInsert = vi.fn((..._args: any[]) => makeBuilder());
const mockSelect = vi.fn((..._args: any[]) => makeBuilder());
const mockUpdate = vi.fn((..._args: any[]) => makeBuilder());
const mockDelete = vi.fn((..._args: any[]) => makeBuilder());

vi.mock('../db/index.js', () => ({
  db: {
    insert: (...args: any[]) => mockInsert(...args),
    select: (...args: any[]) => mockSelect(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

vi.mock('../db/schema.js', () => ({
  expenses: {
    id: 'expenses.id',
    tripId: 'expenses.trip_id',
    deletedAt: 'expenses.deleted_at',
  },
  expenseSplits: {
    id: 'expense_splits.id',
    expenseId: 'expense_splits.expense_id',
  },
  settlements: {
    id: 'settlements.id',
    tripId: 'settlements.trip_id',
  },
  users: {
    id: 'users.id',
    name: 'users.name',
  },
}));

const mockGetMembers = vi.fn();
vi.mock('./trip.service.js', () => ({
  getMembers: (...args: any[]) => mockGetMembers(...args),
}));

vi.mock('./activity-feed.service.js', () => ({
  logAction: vi.fn(() => Promise.resolve()),
  logActivityAndBroadcast: vi.fn(() => Promise.resolve(null)),
}));

import {
  calculateEqualSplitMinor,
  calculatePercentageSplitMinor,
  validateCustomSplitMinor,
  validatePercentageSplit,
  sumMinor,
  createExpense,
  updateExpense,
  deleteExpense,
  recordSettlement,
  getTripSummary,
  getBalances,
  computeSettlements,
  simplifyDebts,
} from './expense.service.js';
import { ErrorCodes } from '@trip-planner/shared';
import { logActivityAndBroadcast } from './activity-feed.service.js';

// ─── Pure Split Math ─────────────────────────────────────────────────────────

describe('Expense Service — split math (integer minor units)', () => {
  describe('calculateEqualSplitMinor', () => {
    it('splits an evenly divisible amount equally', () => {
      const splits = calculateEqualSplitMinor(30000, 3);
      expect(splits).toEqual([10000, 10000, 10000]);
      expect(sumMinor(splits)).toBe(30000);
    });

    it('assigns remainder minor units to the first members deterministically', () => {
      const splits = calculateEqualSplitMinor(10000, 3); // 3334 + 3333 + 3333
      expect(splits).toEqual([3334, 3333, 3333]);
      expect(sumMinor(splits)).toBe(10000);
    });

    it('returns empty for non-positive member counts', () => {
      expect(calculateEqualSplitMinor(10000, 0)).toEqual([]);
    });
  });

  describe('calculatePercentageSplitMinor', () => {
    it('computes minor-unit shares from percentages summing to the total', () => {
      const splits = calculatePercentageSplitMinor(20000, [50, 50]);
      expect(splits).toEqual([10000, 10000]);
      expect(sumMinor(splits)).toBe(20000);
    });

    it('absorbs rounding remainder into the last share', () => {
      const splits = calculatePercentageSplitMinor(10000, [33.33, 33.33, 33.34]);
      expect(sumMinor(splits)).toBe(10000);
    });
  });

  describe('validateCustomSplitMinor', () => {
    it('accepts owed shares that sum exactly to the total', () => {
      expect(validateCustomSplitMinor(10000, [4000, 6000])).toBe(true);
    });

    it('rejects owed shares that do not sum to the total', () => {
      expect(validateCustomSplitMinor(10000, [4000, 4000])).toBe(false);
    });
  });

  describe('validatePercentageSplit', () => {
    it('accepts percentages summing to 100', () => {
      expect(validatePercentageSplit([50, 50])).toBe(true);
      expect(validatePercentageSplit([33.33, 33.33, 33.34])).toBe(true);
    });

    it('rejects percentages not summing to 100', () => {
      expect(validatePercentageSplit([50, 40])).toBe(false);
    });
  });
});

// ─── Persistence & Business Logic ────────────────────────────────────────────

describe('Expense Service — persistence', () => {
  beforeEach(() => {
    resultQueue = [];
    valuesCalls.length = 0;
    setCalls.length = 0;
    vi.clearAllMocks();
  });

  describe('createExpense — equal split, single payer', () => {
    it('creates splits whose owed and paid shares each sum to the total', async () => {
      mockGetMembers.mockResolvedValueOnce([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      const fakeExpense = { id: 'exp-1', tripId: 'trip-1', amountMinor: 10000 };
      resultQueue.push([fakeExpense]); // expense insert returning
      resultQueue.push([
        { id: 's1', expenseId: 'exp-1', userId: 'user-1', owedMinor: 3334, paidMinor: 10000 },
        { id: 's2', expenseId: 'exp-1', userId: 'user-2', owedMinor: 3333, paidMinor: 0 },
        { id: 's3', expenseId: 'exp-1', userId: 'user-3', owedMinor: 3333, paidMinor: 0 },
      ]); // splits insert returning

      const result = await createExpense('trip-1', {
        title: 'Dinner',
        amountMinor: 10000,
        paidBy: 'user-1',
        splitType: 'equal',
      });

      expect('error' in result).toBe(false);

      // valuesCalls[1] holds the split rows inserted.
      const insertedSplits = valuesCalls[1] as { owedMinor: number; paidMinor: number }[];
      expect(sumMinor(insertedSplits.map((s) => s.owedMinor))).toBe(10000);
      expect(sumMinor(insertedSplits.map((s) => s.paidMinor))).toBe(10000);
    });
  });

  describe('createExpense — multi-payer', () => {
    it('records paid shares that each sum to the total alongside owed shares', async () => {
      resultQueue.push([{ id: 'exp-2', tripId: 'trip-1', amountMinor: 10000 }]);
      resultQueue.push([]); // splits returning (unused in assertions)

      const result = await createExpense('trip-1', {
        title: 'Hotel',
        amountMinor: 10000,
        splitType: 'custom',
        customSplits: [
          { userId: 'user-1', owedMinor: 5000 },
          { userId: 'user-2', owedMinor: 5000 },
        ],
        payers: [
          { userId: 'user-1', paidMinor: 6000 },
          { userId: 'user-2', paidMinor: 4000 },
        ],
      });

      expect('error' in result).toBe(false);
      const insertedSplits = valuesCalls[1] as { owedMinor: number; paidMinor: number }[];
      expect(sumMinor(insertedSplits.map((s) => s.owedMinor))).toBe(10000);
      expect(sumMinor(insertedSplits.map((s) => s.paidMinor))).toBe(10000);
    });

    it('rejects when paid shares do not sum to the total', async () => {
      const result = await createExpense('trip-1', {
        title: 'Hotel',
        amountMinor: 10000,
        splitType: 'custom',
        customSplits: [
          { userId: 'user-1', owedMinor: 5000 },
          { userId: 'user-2', owedMinor: 5000 },
        ],
        payers: [
          { userId: 'user-1', paidMinor: 6000 },
          { userId: 'user-2', paidMinor: 3000 }, // sums to 9000, not 10000
        ],
      });

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.EXPENSE_INVALID_SPLIT);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('createExpense — custom split validation', () => {
    it('rejects owed shares that do not sum to the total', async () => {
      const result = await createExpense('trip-1', {
        title: 'Cab',
        amountMinor: 10000,
        paidBy: 'user-1',
        splitType: 'custom',
        customSplits: [
          { userId: 'user-1', owedMinor: 4000 },
          { userId: 'user-2', owedMinor: 4000 },
        ],
      });

      expect('error' in result).toBe(true);
      expect((result as any).error).toBe(ErrorCodes.EXPENSE_INVALID_SPLIT);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('updateExpense', () => {
    it('recomputes splits from the edited input', async () => {
      const existing = {
        id: 'exp-1',
        tripId: 'trip-1',
        title: 'Dinner',
        amountMinor: 10000,
        currency: 'INR',
        paidBy: 'user-1',
        splitType: 'custom',
        activityBlockId: null,
        deletedAt: null,
      };
      resultQueue.push([existing]); // select existing (limit 1)
      resultQueue.push([{ ...existing, amountMinor: 20000 }]); // update returning
      resultQueue.push([]); // delete old splits
      resultQueue.push([
        { id: 's1', expenseId: 'exp-1', userId: 'user-1', owedMinor: 12000, paidMinor: 20000 },
        { id: 's2', expenseId: 'exp-1', userId: 'user-2', owedMinor: 8000, paidMinor: 0 },
      ]); // new splits returning

      const result = await updateExpense('exp-1', {
        actorId: 'user-1',
        amountMinor: 20000,
        paidBy: 'user-1',
        splitType: 'custom',
        customSplits: [
          { userId: 'user-1', owedMinor: 12000 },
          { userId: 'user-2', owedMinor: 8000 },
        ],
      });

      expect(result).not.toBeNull();
      expect('error' in (result as any)).toBe(false);
      const insertedSplits = valuesCalls[0] as { owedMinor: number; paidMinor: number }[];
      expect(sumMinor(insertedSplits.map((s) => s.owedMinor))).toBe(20000);
      expect(sumMinor(insertedSplits.map((s) => s.paidMinor))).toBe(20000);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('returns null when the expense is missing or already deleted', async () => {
      resultQueue.push([]); // select returns nothing
      const result = await updateExpense('missing', { actorId: 'user-1', amountMinor: 5000 });
      expect(result).toBeNull();
    });
  });

  describe('deleteExpense', () => {
    it('soft-deletes the expense and returns the updated row', async () => {
      resultQueue.push([
        { id: 'exp-1', tripId: 'trip-1', title: 'Dinner', paidBy: 'user-1', deletedAt: new Date() },
      ]);

      const deleted = await deleteExpense('exp-1', 'user-1');
      expect(deleted).not.toBeNull();
      expect(deleted!.deletedAt).toBeInstanceOf(Date);
      // The update set a deletedAt timestamp.
      expect(setCalls[0]).toHaveProperty('deletedAt');
    });

    it('returns null when the expense is missing or already deleted', async () => {
      resultQueue.push([]);
      const deleted = await deleteExpense('missing');
      expect(deleted).toBeNull();
    });
  });

  describe('recordSettlement', () => {
    it('inserts a settlement payment record', async () => {
      resultQueue.push([
        { id: 'set-1', tripId: 'trip-1', fromUserId: 'user-2', toUserId: 'user-1', amountMinor: 3000, note: null },
      ]); // settlement insert returning
      resultQueue.push([{ name: 'Alice' }]); // recipient (toUser) name lookup

      const settlement = await recordSettlement('trip-1', 'user-2', 'user-1', 3000);
      expect(settlement).toMatchObject({ fromUserId: 'user-2', toUserId: 'user-1', amountMinor: 3000 });
      expect(valuesCalls[0]).toMatchObject({ amountMinor: 3000 });
    });

    it('logs a settled activity entry with counterparty, formatted amount, and amountMinor', async () => {
      resultQueue.push([
        { id: 'set-1', tripId: 'trip-1', fromUserId: 'user-2', toUserId: 'user-1', amountMinor: 50000, note: null },
      ]); // settlement insert returning
      resultQueue.push([{ name: 'Alice' }]); // recipient (toUser) name lookup -> counterparty

      await recordSettlement('trip-1', 'user-2', 'user-1', 50000);

      // The feed log/broadcast runs in a non-blocking async task; let it flush.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(logActivityAndBroadcast).toHaveBeenCalledWith(
        'trip-1',
        'user-2',
        'settled',
        'settlement',
        'set-1',
        {
          counterparty: 'Alice',
          amount: 'INR 500.00',
          amountMinor: 50000,
          toUserId: 'user-1',
        }
      );
    });
  });

  describe('getTripSummary — balances', () => {
    it('reduces a member net balance by exactly the partial settlement amount', async () => {
      // One expense: user-1 paid 10000, owed 5000 each -> A:+5000, B:-5000
      resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 10000, deletedAt: null }]); // active expenses
      resultQueue.push([
        { userId: 'user-1', owedMinor: 5000, paidMinor: 10000 },
        { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
      ]); // splits for exp-1

      // Partial settlement: user-2 pays user-1 3000.
      resultQueue.push([
        { fromUserId: 'user-2', toUserId: 'user-1', amountMinor: 3000 },
      ]); // settlements

      const summary = await getTripSummary('trip-1');
      expect(summary.totalMinor).toBe(10000);

      const balanceOf = (id: string) =>
        summary.memberBalances.find((b) => b.userId === id)!.balanceMinor;

      // Pre-settlement: +5000 / -5000. Post-settlement of 3000: +2000 / -2000.
      expect(balanceOf('user-1')).toBe(2000);
      expect(balanceOf('user-2')).toBe(-2000);
    });
  });
});

// ─── Debt Simplification (pure) ──────────────────────────────────────────────

describe('simplifyDebts — greedy min-transactions (integer minor units)', () => {
  /** Folds suggested settlements back into balances exactly as getBalances does. */
  function applySettlements(
    balances: Map<string, number>,
    txns: { from: string; to: string; amountMinor: number }[]
  ): Map<string, number> {
    const result = new Map(balances);
    const bump = (userId: string, delta: number) =>
      result.set(userId, (result.get(userId) ?? 0) + delta);
    for (const t of txns) {
      // from_user += amount, to_user -= amount (consistent with settlements fold)
      bump(t.from, t.amountMinor);
      bump(t.to, -t.amountMinor);
    }
    return result;
  }

  it('returns no transactions when everyone is settled', () => {
    const balances = new Map([
      ['a', 0],
      ['b', 0],
    ]);
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it('matches a single creditor against multiple debtors', () => {
    const balances = new Map([
      ['a', 5000], // owed
      ['b', -3000], // owes
      ['c', -2000], // owes
    ]);
    const txns = simplifyDebts(balances);

    expect(txns).toHaveLength(2);
    // Every transaction flows into the sole creditor.
    expect(txns.every((t) => t.to === 'a')).toBe(true);
    expect(sumMinor(txns.map((t) => t.amountMinor))).toBe(5000);
    // Recording all suggested settlements zeros every balance.
    for (const [, bal] of applySettlements(balances, txns)) {
      expect(bal).toBe(0);
    }
  });

  it('produces at most n-1 transactions and zeros all balances for 4 members', () => {
    const balances = new Map([
      ['a', 6000],
      ['b', 1000],
      ['c', -4000],
      ['d', -3000],
    ]);
    const txns = simplifyDebts(balances);

    const nonZero = Array.from(balances.values()).filter((v) => v !== 0).length;
    expect(txns.length).toBeLessThanOrEqual(nonZero - 1);

    for (const [, bal] of applySettlements(balances, txns)) {
      expect(bal).toBe(0);
    }
  });

  it('ignores exact-zero balances and never emits fractional amounts', () => {
    const balances = new Map([
      ['a', 3333],
      ['b', 3333],
      ['c', 3334],
      ['d', -10000],
    ]);
    const txns = simplifyDebts(balances);

    expect(txns.every((t) => Number.isInteger(t.amountMinor) && t.amountMinor > 0)).toBe(true);
    expect(sumMinor(txns.map((t) => t.amountMinor))).toBe(10000);
    for (const [, bal] of applySettlements(balances, txns)) {
      expect(bal).toBe(0);
    }
  });
});

// ─── getBalances / computeSettlements (DB-backed) ────────────────────────────

describe('Expense Service — balances & settlement computation', () => {
  beforeEach(() => {
    resultQueue = [];
    valuesCalls.length = 0;
    setCalls.length = 0;
    vi.clearAllMocks();
  });

  it('getBalances computes net = paid - owed per member, folding settlements', () => {
    return (async () => {
      // One expense: user-1 paid 10000, each owes 5000 -> +5000 / -5000.
      resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 10000, deletedAt: null }]);
      resultQueue.push([
        { userId: 'user-1', owedMinor: 5000, paidMinor: 10000 },
        { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
      ]);
      resultQueue.push([]); // no settlements

      const balances = await getBalances('trip-1');
      expect(balances.get('user-1')).toBe(5000);
      expect(balances.get('user-2')).toBe(-5000);
    })();
  });

  it('computeSettlements suggests the minimal transaction to clear balances', async () => {
    resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 10000, deletedAt: null }]);
    resultQueue.push([
      { userId: 'user-1', owedMinor: 5000, paidMinor: 10000 },
      { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
    ]);
    resultQueue.push([]); // no settlements

    const txns = await computeSettlements('trip-1');
    expect(txns).toEqual([
      { from: 'user-2', to: 'user-1', amountMinor: 5000, currency: 'INR' },
    ]);
  });

  it('getTripSummary includes total, per-member balances, and suggested settlements', async () => {
    resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 10000, deletedAt: null }]);
    resultQueue.push([
      { userId: 'user-1', owedMinor: 5000, paidMinor: 10000 },
      { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
    ]);
    resultQueue.push([]); // no settlements

    const summary = await getTripSummary('trip-1');
    expect(summary.totalMinor).toBe(10000);
    expect(summary.settlements).toEqual([
      { from: 'user-2', to: 'user-1', amountMinor: 5000, currency: 'INR' },
    ]);
  });

  it('recording the suggested settlements zeros every balance (4 members)', async () => {
    // Expense A: user-1 paid 20000, 4 members owe 5000 each.
    //   -> user-1 +15000, others -5000 each.
    resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 20000, deletedAt: null }]);
    resultQueue.push([
      { userId: 'user-1', owedMinor: 5000, paidMinor: 20000 },
      { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
      { userId: 'user-3', owedMinor: 5000, paidMinor: 0 },
      { userId: 'user-4', owedMinor: 5000, paidMinor: 0 },
    ]);
    resultQueue.push([]); // no settlements yet

    const suggested = await computeSettlements('trip-1');
    // 3 debtors -> at most 3 transactions, all flowing to the sole creditor.
    expect(suggested.length).toBeLessThanOrEqual(3);
    expect(suggested.every((t) => t.to === 'user-1')).toBe(true);
    expect(sumMinor(suggested.map((t) => t.amountMinor))).toBe(15000);

    // Now recompute balances WITH those settlements recorded -> everyone zero.
    resultQueue.push([{ id: 'exp-1', tripId: 'trip-1', amountMinor: 20000, deletedAt: null }]);
    resultQueue.push([
      { userId: 'user-1', owedMinor: 5000, paidMinor: 20000 },
      { userId: 'user-2', owedMinor: 5000, paidMinor: 0 },
      { userId: 'user-3', owedMinor: 5000, paidMinor: 0 },
      { userId: 'user-4', owedMinor: 5000, paidMinor: 0 },
    ]);
    resultQueue.push(
      suggested.map((t) => ({ fromUserId: t.from, toUserId: t.to, amountMinor: t.amountMinor }))
    );

    const balances = await getBalances('trip-1');
    for (const [, bal] of balances) {
      expect(bal).toBe(0);
    }
  });
});
