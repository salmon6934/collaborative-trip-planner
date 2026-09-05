'use client';

import { useState } from 'react';

import {
  formatMoney,
  parseMoneyToMinor,
  toMajorString,
  currencyDecimals,
} from '@/lib/format';

export interface PaymentDraft {
  fromUserId: string;
  toUserId: string;
  amountMinor: number;
  currency: string;
}

interface RecordPaymentModalProps {
  draft: PaymentDraft;
  fromName: string;
  toName: string;
  onRecord: (input: {
    fromUserId: string;
    toUserId: string;
    amountMinor: number;
    note?: string | null;
  }) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Small modal to record a settlement payment. The amount defaults to the
 * suggested amount but can be edited to record a partial payment.
 */
export function RecordPaymentModal({
  draft,
  fromName,
  toName,
  onRecord,
  onClose,
}: RecordPaymentModalProps) {
  const [amount, setAmount] = useState(toMajorString(draft.amountMinor, draft.currency));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const decimals = currencyDecimals(draft.currency);
  const amountMinor = parseMoneyToMinor(amount, draft.currency);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountMinor == null || amountMinor <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (amountMinor > draft.amountMinor) {
      setError(`Amount cannot exceed ${formatMoney(draft.amountMinor, draft.currency)}`);
      return;
    }
    setError('');
    setSubmitting(true);
    const ok = await onRecord({
      fromUserId: draft.fromUserId,
      toUserId: draft.toUserId,
      amountMinor,
      note: note.trim() || null,
    });
    setSubmitting(false);
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-foreground">Record Payment</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{fromName}</span> pays{' '}
          <span className="font-medium text-foreground">{toName}</span>
        </p>

        {error && (
          <div className="mt-3 rounded-lg bg-danger-tint p-3 text-sm text-danger">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="payment-amount" className="block text-sm font-medium text-foreground">
              Amount
            </label>
            <input
              id="payment-amount"
              type="number"
              step={decimals > 0 ? '0.01' : '1'}
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Suggested: {formatMoney(draft.amountMinor, draft.currency)} · partial payments allowed
            </p>
          </div>

          <div>
            <label htmlFor="payment-note" className="block text-sm font-medium text-foreground">
              Note (optional)
            </label>
            <input
              id="payment-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Paid via UPI"
              maxLength={500}
              className="mt-1 block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
