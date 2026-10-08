import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapUserLedger, createPortfolio, createTransaction, getNamespaceSnapshot,
  listPortfolios, pushPendingLedgerChanges, readSyncQueueSize, updatePortfolio,
} from '@/lib/ledger/db';
import type { LedgerSyncOperation } from '@/lib/ledger/types';

const fetchMock = vi.fn();
const namespace = 'user:test' as const;
const remote = { portfolios: [{ id: 'remote', name: 'Cloud', currency: 'USD' }], transactions: [] };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const operations = (init: RequestInit) => JSON.parse(init.body as string).operations as LedgerSyncOperation[];
const acknowledge = (_url: string, init: RequestInit) => response({
  appliedOperationIds: operations(init).map(op => op.id),
});

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

async function addPortfolio(id: string) {
  return createPortfolio({ namespace, id, name: id, currency: 'USD' });
}

describe('ledger sync against IndexedDB', () => {
  it('preserves insertion order when timestamps tie and UUIDs sort backwards', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T00:00:00Z'));
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('z').mockReturnValueOnce('a') });
    await addPortfolio('one');
    await updatePortfolio({ namespace, id: 'one', name: 'Edited' });
    fetchMock.mockImplementation(acknowledge);
    expect(await pushPendingLedgerChanges('test')).toBe(true);
    expect(operations(fetchMock.mock.calls[0][1]).map(op => op.payload.name)).toEqual(['one', 'Edited']);
  });

  it('retains unacknowledged operations and their pending state after partial acceptance', async () => {
    await addPortfolio('one');
    await addPortfolio('two');
    let acceptedRecord = '';
    fetchMock.mockImplementation((_url, init) => {
      const first = operations(init)[0];
      acceptedRecord = first.recordId;
      return response({ appliedOperationIds: [first.id] }, 409);
    });
    expect(await pushPendingLedgerChanges('test')).toBe(false);
    expect(await readSyncQueueSize(namespace)).toBe(1);
    const rows = await listPortfolios(namespace);
    expect(rows.find(row => row.id === acceptedRecord)?.syncState).toBe('synced');
    expect(rows.find(row => row.id !== acceptedRecord)?.syncState).toBe('pending');
    fetchMock.mockImplementation(acknowledge);
    expect(await pushPendingLedgerChanges('test')).toBe(true);
    expect(await readSyncQueueSize(namespace)).toBe(0);
  });

  it('splits more than 200 operations into bounded batches', async () => {
    for (let i = 0; i < 201; i++) await addPortfolio(`portfolio-${i}`);
    fetchMock.mockImplementation(acknowledge);
    expect(await pushPendingLedgerChanges('test')).toBe(true);
    expect(fetchMock.mock.calls.map(([, init]) => operations(init).length)).toEqual([200, 1]);
    expect(await readSyncQueueSize(namespace)).toBe(0);
  });

  it.each(['network', 'http', 'legacy', 'malformed'])('retains the queue after %s failure', async (failure) => {
    await addPortfolio('one');
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
    if (failure === 'http') fetchMock.mockResolvedValue(response({}, 500));
    if (failure === 'legacy') fetchMock.mockResolvedValue(response({ ok: true, applied: 1 }));
    if (failure === 'malformed') fetchMock.mockResolvedValue(new Response('not json'));
    expect(await pushPendingLedgerChanges('test')).toBe(false);
    expect(await readSyncQueueSize(namespace)).toBe(1);
    fetchMock.mockImplementation(acknowledge);
    expect(await pushPendingLedgerChanges('test')).toBe(true);
  });

  it('coalesces concurrent pushes and keeps edits made during a request pending', async () => {
    await addPortfolio('one');
    let release!: (response: Response) => void;
    let sent!: LedgerSyncOperation[];
    const started = new Promise<void>(resolve => {
      fetchMock.mockImplementation((_url, init) => {
        sent = operations(init);
        resolve();
        return new Promise<Response>(done => { release = done; });
      });
    });
    const first = pushPendingLedgerChanges('test');
    const second = pushPendingLedgerChanges('test');
    expect(first).toBe(second);
    await started;
    await updatePortfolio({ namespace, id: 'one', name: 'Edited during request' });
    release(response({ appliedOperationIds: sent.map(op => op.id) }));
    await first;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await readSyncQueueSize(namespace)).toBe(1);
    expect((await listPortfolios(namespace))[0]).toMatchObject({ name: 'Edited during request', syncState: 'pending' });
  });
});

describe('first login', () => {
  it('loads an existing cloud account even when a default guest portfolio exists', async () => {
    await listPortfolios('guest');
    fetchMock.mockResolvedValue(response(remote));
    expect(await bootstrapUserLedger('test')).toBe(true);
    expect((await listPortfolios(namespace)).map(row => row.id)).toEqual(['remote']);
    expect(await readSyncQueueSize(namespace)).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await listPortfolios('guest'))).toHaveLength(1);
  });

  it('preserves real guest trades when the account already has cloud data', async () => {
    const [guest] = await listPortfolios('guest');
    await createTransaction({ namespace: 'guest', portfolioId: guest.id, type: 'BUY',
      date: '2026-10-08', quantity: 1, price: 100, priceUSD: 100, exchangeRate: 1,
      fee: 0, currency: 'USD', asset: { ticker: 'AAPL', name: 'Apple', market: 'US', currency: 'USD' } });
    fetchMock.mockResolvedValue(response(remote));
    await bootstrapUserLedger('test');
    expect((await getNamespaceSnapshot('guest')).transactions).toHaveLength(1);
    expect((await listPortfolios(namespace)).map(row => row.id)).toEqual(['remote']);
  });

  it('does not clone guest data on a failed pull; retries successfully later', async () => {
    await listPortfolios('guest');
    fetchMock.mockResolvedValue(response({}, 503));
    expect(await bootstrapUserLedger('test')).toBe(false);
    expect(await listPortfolios(namespace)).toEqual([]);
    expect(await readSyncQueueSize(namespace)).toBe(0);
    fetchMock.mockResolvedValue(response(remote));
    expect(await bootstrapUserLedger('test')).toBe(true);
    expect((await listPortfolios(namespace))[0].id).toBe('remote');
  });

  it('clones guest data only for an empty cloud account and coalesces bootstraps', async () => {
    await listPortfolios('guest');
    fetchMock.mockImplementation((url, init) => url === '/api/sync/pull'
      ? response({ portfolios: [], transactions: [] }) : acknowledge(url, init));
    const first = bootstrapUserLedger('test');
    expect(bootstrapUserLedger('test')).toBe(first);
    expect(await first).toBe(true);
    expect(await listPortfolios(namespace)).toHaveLength(1);
    expect(await readSyncQueueSize(namespace)).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not replace local pending changes with a cloud snapshot', async () => {
    await addPortfolio('local');
    fetchMock.mockImplementation((url, init) => url === '/api/sync/pull'
      ? response(remote) : acknowledge(url, init));
    await bootstrapUserLedger('test');
    expect((await listPortfolios(namespace)).map(row => row.id)).toEqual(['local']);
  });
});
