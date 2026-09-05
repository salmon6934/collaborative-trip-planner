'use client';

import type { ExpenseWithSplits } from '@/hooks/useExpenses';
import { formatMoney } from '@/lib/format';

interface ExpenseCardProps {
  expense: ExpenseWithSplits;
  /** userId -> display name lookup. */
  memberNames: Map<string, string>;
  /** blockId -> title lookup for the linked activity. */
  blockNames: Map<string, string>;
  currentUserId: string | undefined;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const SPLIT_LABELS: Record<string, string> = {
  equal: 'Equal',
  custom: 'Custom',
  percentage: 'Percentage',
};

export function ExpenseCard({
  expense,
  memberNames,
  blockNames,
  currentUserId,
  canManage,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const nameFor = (userId: string) =>
    userId === currentUserId ? 'You' : memberNames.get(userId) ?? 'Someone';

  const payers = expense.splits.filter((s) => s.paidMinor > 0);
  const payerLabel =
    payers.length === 0
      ? nameFor(expense.paidBy)
      : payers.length === 1
        ? nameFor(payers[0].userId)
        : payers.map((p) => nameFor(p.userId)).join(', ');

  const linkedBlockName = expense.activityBlockId
    ? blockNames.get(expense.activityBlockId)
    : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {/* Leading icon tile — echoes the reference's category tile. Expenses
              carry no category field (only an optional linked activity), so this
              is a neutral marker rather than category-coded. */}
          <span
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-tint text-lg"
            aria-hidden="true"
          >
            🧾
          </span>
          <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-foreground">{expense.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Paid by <span className="font-medium text-foreground">{payerLabel}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-tint-foreground">
              {SPLIT_LABELS[expense.splitType] ?? expense.splitType} split
            </span>
            {linkedBlockName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5"
                  />
                </svg>
                {linkedBlockName}
              </span>
            )}
          </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="stat-number whitespace-nowrap text-lg text-foreground">
            {formatMoney(expense.amountMinor, expense.currency)}
          </span>
          {canManage && (
            <div className="flex items-center gap-1">
              <button
                onClick={onEdit}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                title="Edit expense"
                aria-label="Edit expense"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-danger"
                title="Delete expense"
                aria-label="Delete expense"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
