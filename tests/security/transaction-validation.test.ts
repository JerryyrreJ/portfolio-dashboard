import { describe, expect, it } from 'vitest';
import { getPriceUSD } from '@/lib/exchange-rate';
import type { Prisma } from '@prisma/client';
import { importTransactionsInTransaction } from '@/lib/transactions/import';
import {
  MAX_TRANSACTION_TOTAL,
  parseImportRequest,
  parseIsoDate,
  parseNonNegativeNumber,
  parsePositiveNumber,
} from '@/lib/transactions/parse';

function request(overrides: Record<string, unknown> = {}) {
  return parseImportRequest({
    portfolioId: 'portfolio',
    transactions: [{
      ticker: 'AAPL',
      type: 'BUY',
      quantity: 1,
      price: 10,
      date: '2026-09-22',
      ...overrides,
    }],
  });
}

describe('transaction input validation', () => {
  it.each([true, '1', [123], { value: 1 }, Number.POSITIVE_INFINITY, 1e308])(
    'rejects a coerced or unbounded positive number: %j',
    (value) => expect(parsePositiveNumber(value)).toBeNull(),
  );

  it.each([false, '0', [0], Number.NaN, Number.NEGATIVE_INFINITY, 1e308])(
    'rejects a coerced or unbounded non-negative number: %j',
    (value) => expect(parseNonNegativeNumber(value)).toBeNull(),
  );

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-01-01T24:00:00Z', ' 2026-01-01'])(
    'rejects the invalid ISO date %s',
    (value) => expect(parseIsoDate(value)).toBeNull(),
  );

  it.each(['2024-02-29', '2026-09-22T12:30Z', '2026-09-22T12:30:45.123Z'])(
    'accepts the valid ISO date %s',
    (value) => expect(parseIsoDate(value)?.toString()).not.toBe('Invalid Date'),
  );

  it('rejects unsupported currencies instead of accepting any three letters', () => {
    const parsed = request({ currency: 'ZZZ' });
    expect(parsed.errors).toContainEqual(expect.objectContaining({
      field: 'currency',
      code: 'INVALID_CURRENCY',
    }));
  });

  it('rejects values whose calculation exceeds the transaction total limit', () => {
    const parsed = request({ quantity: 1_000_000_000, price: 1_000_001 });
    expect(1_000_000_000 * 1_000_001).toBeGreaterThan(MAX_TRANSACTION_TOTAL);
    expect(parsed.errors).toContainEqual(expect.objectContaining({
      code: 'TRANSACTION_VALUE_TOO_LARGE',
    }));
  });

  it('accepts strict finite numbers, a real calendar date, and a supported currency', () => {
    const parsed = request({ quantity: 1.25, price: 100, fee: 0, currency: 'hkd', date: '2024-02-29' });
    expect(parsed.errors).toEqual([]);
    expect(parsed.items[0]).toMatchObject({ quantity: 1.25, price: 100, fee: 0, currency: 'HKD' });
  });

  it('fails explicitly when no supported FX rate exists', async () => {
    await expect(getPriceUSD(100, 'ZZZ')).rejects.toMatchObject({
      code: 'EXCHANGE_RATE_UNAVAILABLE',
    });
  });

  it('does not silently replace a missing import rate with 1', async () => {
    const parsed = request({ currency: 'EUR' });
    await expect(importTransactionsInTransaction({} as Prisma.TransactionClient, {
      portfolioId: 'portfolio',
      items: parsed.items,
      rates: {},
    })).rejects.toMatchObject({ code: 'EXCHANGE_RATE_UNAVAILABLE' });
  });
});
