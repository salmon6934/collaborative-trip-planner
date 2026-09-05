'use client';

import type { PaymentDraft } from './RecordPaymentModal';

import type { SuggestedTransaction, TripSummary } from '@/hooks/useExpenses';
import { formatMoney, formatSignedMoney } from '@/lib/format';

interface SettleUpProps {
  summary: TripSummary | null;
  suggested: SuggestedTransaction[];
  currency: string;
  currentUserId: string | undefined;
  memberNames: Map<string, string>;
  canManage: boolean;
  onRecordPayment: (draft: PaymentDraft) => void;
}

/**
 * "Settle Up" section: lists the minimal set of suggested payments that would
 * zero out every balance, phrased relative to the current user, each with a
 * "Record Payment" action (partial payments supported).
 */
export function SettleUp({
  summary,
  suggested,
  currency,
  currentUserId,
  memberNames,
  canManage,
  onRecordPayment,
}: SettleUpProps) {
  const nameFor = (userId: string) => memberNames.get(userId) ?? 'Someone';

  if (!summary || suggested.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-card p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-success"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="mt-4 text-sm font-medium text-foreground">All settled up</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          There are no outstanding balances between members.
        </p>
      </div>
    );
  }

  // Split suggestions into those involving the current user vs. everyone else.
  const mine = suggested.filter(
    (t) => t.from === currentUserId || t.to === currentUserId
  );
  const others = suggested.filter(
    (t) => t.from !== currentUserId && t.to !== currentUserId
  );

  return (
    <div className="space-y-6">
      {mine.length > 0 && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Your balances
          </h3>
          <div className="mt-3 space-y-2">
            {mine.map((t, i) => {
              const youOwe = t.from === currentUserId;
              const other = youOwe ? t.to : t.from;
              return (
                <div
                  key={`${t.from}-${t.to}-${i}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <p className="text-sm text-foreground">
                    {youOwe ? (
                      <>
                        You owe{' '}
                        <span className="font-medium">{nameFor(other)}</span>{' '}
                        <span className="font-semibold text-danger">
                          {formatMoney(t.amountMinor, currency)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{nameFor(other)}</span> owes you{' '}
                        <span className="font-semibold text-success">
                          {formatMoney(t.amountMinor, currency)}
                        </span>
                      </>
                    )}
                  </p>
                  {canManage && (
                    <button
                      onClick={() =>
                        onRecordPayment({
                          fromUserId: t.from,
                          toUserId: t.to,
                          amountMinor: t.amountMinor,
                          currency,
                        })
                      }
                      className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover transition"
                    >
                      Record Payment
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Other balances
          </h3>
          <div className="mt-3 space-y-2">
            {others.map((t, i) => (
              <div
                key={`${t.from}-${t.to}-${i}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <p className="text-sm text-foreground">
                  <span className="font-medium">{nameFor(t.from)}</span> owes{' '}
                  <span className="font-medium">{nameFor(t.to)}</span>{' '}
                  <span className="font-semibold text-foreground">
                    {formatMoney(t.amountMinor, currency)}
                  </span>
                </p>
                {canManage && (
                  <button
                    onClick={() =>
                      onRecordPayment({
                        fromUserId: t.from,
                        toUserId: t.to,
                        amountMinor: t.amountMinor,
                        currency,
                      })
                    }
                    className="whitespace-nowrap rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
                  >
                    Record Payment
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-member net balances */}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Net balances
        </h3>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
          {summary.memberBalances.map((b) => (
            <div key={b.userId} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-foreground">
                {b.userId === currentUserId ? 'You' : nameFor(b.userId)}
              </span>
              <span
                className={`text-sm font-medium ${
                  b.balanceMinor > 0
                    ? 'text-success'
                    : b.balanceMinor < 0
                      ? 'text-danger'
                      : 'text-muted-foreground'
                }`}
              >
                {formatSignedMoney(b.balanceMinor, currency)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
