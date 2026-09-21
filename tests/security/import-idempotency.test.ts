import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiIdempotencyRecord, Prisma } from '@prisma/client';

const mocked = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { $transaction: mocked.transaction } }));
import { runIdempotentImport, type ImportIdempotency } from '@/lib/api/idempotency';
import { importTransactionsInTransaction } from '@/lib/transactions/import';
import { parseImportRequest } from '@/lib/transactions/parse';

type Row = Record<string, unknown>;
const identity: ImportIdempotency = { userId: 'user', key: 'same-key', requestHash: 'same-body' };
let records: Map<string, ApiIdempotencyRecord>;
let trades: Row[];
let assets: Map<string, Row>;
let locks: Set<string>;
let failResponseWrite: boolean;
let sequence: number;
const keyOf = (userId: string, key: string) => JSON.stringify([userId, key]);

// Transactional test double: uncommitted writes are private, failed callbacks roll
// back, advisory locks live until transaction end. No production database access.
beforeEach(() => {
  records = new Map(); trades = []; assets = new Map(); locks = new Set();
  failResponseWrite = false; sequence = 0;
  mocked.transaction.mockImplementation(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
    const localRecords = new Map(records);
    const localTrades: Row[] = [];
    const localAssets = new Map(assets);
    let held: string | undefined;
    const tx = {
      $queryRaw: async (_sql: TemplateStringsArray, key: string) => {
        if (locks.has(key)) return [{ acquired: false }];
        locks.add(key); held = key;
        return [{ acquired: true }];
      },
      apiIdempotencyRecord: {
        findUnique: async ({ where }: { where: { userId_key: { userId: string; key: string } } }) =>
          localRecords.get(keyOf(where.userId_key.userId, where.userId_key.key)) ?? null,
        delete: async ({ where }: { where: { id: string } }) => {
          for (const [key, row] of localRecords) if (row.id === where.id) localRecords.delete(key);
        },
        create: async ({ data }: { data: Omit<ApiIdempotencyRecord, 'id' | 'createdAt'> }) => {
          if (failResponseWrite) throw new Error('simulated response storage failure');
          localRecords.set(keyOf(data.userId, data.key), { ...data, id: 'record', createdAt: new Date() });
        },
      },
      asset: {
        upsert: async ({ where, create }: { where: { ticker: string }; create: Row }) => {
          const row = localAssets.get(where.ticker) ?? { id: 'asset-' + where.ticker, ...create };
          localAssets.set(where.ticker, row); return row;
        },
      },
      transaction: {
        findMany: async ({ where }: { where: { portfolioId: string; importKey: { in: string[] } } }) =>
          trades.filter(t => t.portfolioId === where.portfolioId && where.importKey.in.includes(t.importKey as string))
            .map(t => ({ ...t, asset: [...localAssets.values()].find(a => a.id === t.assetId) })),
        create: async ({ data }: { data: Row }) => {
          const row = { id: 'trade-' + (++sequence), ...data }; localTrades.push(row); return row;
        },
      },
    };
    try {
      const result = await callback(tx as unknown as Prisma.TransactionClient);
      // Only successful callbacks commit writes.
      records = localRecords; assets = localAssets; trades.push(...localTrades);
      return result;
    } finally { if (held) locks.delete(held); }
  });
});

function operation(clientKey?: string) {
  const parsed = parseImportRequest({ portfolioId: 'owned', transactions: [{
    ticker: '0700.HK', name: 'Untrusted', market: 'FAKE', currency: 'USD',
    type: 'BUY', quantity: 1, price: 2, date: '2026-09-20', clientKey,
  }] });
  return async (tx: Prisma.TransactionClient) => importTransactionsInTransaction(tx, {
    portfolioId: 'owned', items: parsed.items, rates: { USD: 1 },
  });
}

function stored(overrides: Partial<ApiIdempotencyRecord> = {}): ApiIdempotencyRecord {
  return { ...identity, id: 'record', createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
    statusCode: 200, responseJson: JSON.stringify({ original: true }), ...overrides };
}

describe('atomic import and request idempotency', () => {
  it('allows only one concurrent execution with no per-item clientKey', async () => {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>(r => { entered = r; });
    const gate = new Promise<void>(r => { release = r; });
    const first = runIdempotentImport(identity, async tx => {
      entered(); await gate; return operation()(tx);
    });
    await started;
    await expect(runIdempotentImport(identity, operation())).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    release();
    const original = await first;
    const retry = await runIdempotentImport(identity, operation());
    expect(trades).toHaveLength(1);
    expect(retry.replayed).toBe(true);
    expect(retry.payload).toEqual(original.payload);
    expect(locks.size).toBe(0);
  });

  it('rolls back trade AND asset writes if response persistence fails, then retries once', async () => {
    failResponseWrite = true;
    await expect(runIdempotentImport(identity, operation())).rejects.toThrow('response storage failure');
    expect(trades).toHaveLength(0); expect(records.size).toBe(0); expect(assets.size).toBe(0);
    expect(locks.size).toBe(0);
    failResponseWrite = false;
    await runIdempotentImport(identity, operation());
    expect(trades).toHaveLength(1); expect(records.size).toBe(1);
  });

  it('replays after a lost HTTP response without executing the operation again', async () => {
    await runIdempotentImport(identity, operation());
    const forbidden = vi.fn();
    expect((await runIdempotentImport(identity, forbidden)).replayed).toBe(true);
    expect(forbidden).not.toHaveBeenCalled(); expect(trades).toHaveLength(1);
  });

  it('rejects same key with a different request body', async () => {
    await runIdempotentImport(identity, operation());
    await expect(runIdempotentImport({ ...identity, requestHash: 'different' }, operation()))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    expect(trades).toHaveLength(1);
  });

  it('replaces expired records atomically', async () => {
    records.set(keyOf(identity.userId, identity.key), stored({ expiresAt: new Date(0), requestHash: 'old' }));
    expect((await runIdempotentImport(identity, operation())).replayed).toBe(false);
    expect(trades).toHaveLength(1); expect(records.size).toBe(1);
  });

  it('does not steal legacy pending records', async () => {
    records.set(keyOf(identity.userId, identity.key), stored({ statusCode: 202 }));
    await expect(runIdempotentImport(identity, operation())).rejects.toMatchObject({ code: 'IDEMPOTENCY_IN_PROGRESS' });
    expect(trades).toHaveLength(0);
  });

  it('keeps the same key independent between users', async () => {
    await runIdempotentImport(identity, operation());
    await runIdempotentImport({ ...identity, userId: 'other' }, operation());
    expect(records.size).toBe(2); expect(trades).toHaveLength(2);
  });

  it('retains per-item replay and leaves existing trades in their original batch', async () => {
    const first = await runIdempotentImport(null, operation('client-1'));
    const second = await runIdempotentImport(null, operation('client-1'));
    expect(trades).toHaveLength(1);
    expect(second.payload.results[0].status).toBe('existing');
    expect(second.payload.importBatchId).toBe(first.payload.importBatchId);
  });

  it('does not promote trade currency or supplied profile fields into the shared asset', async () => {
    await runIdempotentImport(identity, operation());
    expect(assets.get('0700.HK')).toMatchObject({ name: '0700.HK', market: 'HK', currency: 'HKD' });
    expect(trades[0].currency).toBe('USD');
  });
});
