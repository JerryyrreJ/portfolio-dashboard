'use client';

import { createTransaction, pushPendingLedgerChanges } from '@/lib/ledger/db';
import type { CreateLedgerTransactionInput } from '@/lib/ledger/types';

export async function submitTransaction(
  storage: 'local' | 'cloud', input: Omit<CreateLedgerTransactionInput, 'namespace'>, userId?: string,
) {
  if (storage === 'local') return createTransaction({ ...input, namespace: 'guest' });
  await flushLegacyCloudWrites(userId);
  const response = await fetch('/api/transactions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId: input.portfolioId, ticker: input.asset.ticker,
      type: input.type, quantity: input.quantity, price: input.price, fee: input.fee,
      date: input.date, currency: input.currency, notes: input.notes,
    }),
  });
  if (!response.ok) throw new Error('Failed to save transaction to cloud');
}

// Finish pre-migration writes before a newer cloud edit/delete, so a delayed
// queue cannot subsequently restore an old transaction or overwrite that edit.
export async function flushLegacyCloudWrites(userId?: string) {
  if (!userId || !await pushPendingLedgerChanges(userId)) {
    throw new Error('Pending changes must sync before editing cloud transactions');
  }
}
