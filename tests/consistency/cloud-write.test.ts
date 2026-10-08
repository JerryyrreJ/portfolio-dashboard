import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ local: vi.fn(), sync: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/ledger/db', () => ({ createTransaction: mock.local, pushPendingLedgerChanges: mock.sync }));
import { submitTransaction, flushLegacyCloudWrites } from '@/lib/transactions/client';
const input = { portfolioId: 'p', type: 'BUY' as const, date: '2026-10-08', quantity: 2,
  price: 100, priceUSD: 999, exchangeRate: 999, fee: 0, currency: 'USD',
  asset: { ticker: 'AAPL', name: 'Apple', market: 'US', currency: 'USD' } };
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', mock.fetch); mock.sync.mockResolvedValue(true); });
describe('transaction persistence boundary', () => {
  it('keeps guest writes local without making a network request', async () => {
    await submitTransaction('local', input);
    expect(mock.local).toHaveBeenCalledWith({ ...input, namespace: 'guest' });
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('finishes old queued writes before posting a cloud transaction without trusting client FX', async () => {
    mock.fetch.mockResolvedValue(new Response('{}', { status: 201 }));
    await submitTransaction('cloud', input, 'user');
    expect(mock.sync).toHaveBeenCalledWith('user');
    expect(mock.sync.mock.invocationCallOrder[0]).toBeLessThan(mock.fetch.mock.invocationCallOrder[0]);
    const payload = JSON.parse(mock.fetch.mock.calls[0][1].body);
    expect(payload).toMatchObject({ portfolioId: 'p', ticker: 'AAPL', quantity: 2 });
    expect(payload).not.toHaveProperty('priceUSD');
    expect(payload).not.toHaveProperty('exchangeRate');
    expect(mock.local).not.toHaveBeenCalled();
  });
  it.each([401, 500])('does not silently fall back to local after HTTP %s', async status => {
    mock.fetch.mockResolvedValue(new Response('{}', { status }));
    await expect(submitTransaction('cloud', input, 'user')).rejects.toThrow();
    expect(mock.local).not.toHaveBeenCalled();
  });
  it('keeps failed legacy operations from overwriting a newer edit or delete', async () => {
    mock.sync.mockResolvedValue(false);
    await expect(flushLegacyCloudWrites('user')).rejects.toThrow();
    await expect(submitTransaction('cloud', input, 'user')).rejects.toThrow();
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('fails closed if a cloud caller forgot its user identity', async () => {
    await expect(submitTransaction('cloud', input)).rejects.toThrow();
    expect(mock.local).not.toHaveBeenCalled();
  });
});
