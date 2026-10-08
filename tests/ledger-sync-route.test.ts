import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/ownership', () => ({ requireAuthenticatedUser: mock.auth }));
vi.mock('@/lib/prisma', () => ({ default: { portfolio: {
  findUnique: mock.find, create: mock.create, update: mock.update,
} } }));
vi.mock('@/lib/transactions/asset', () => ({ resolveOrCreateAsset: vi.fn() }));
import { POST } from '@/app/api/sync/push/route';
const operation = (id: string) => ({ id: `op-${id}`, recordId: id, namespace: 'user:test',
  entity: 'portfolio', action: 'upsert', updatedAt: '2026-10-08T00:00:00Z',
  payload: { id, name: id, currency: 'USD' } });
const request = (operations: unknown[]) => new NextRequest('http://localhost/api/sync/push', {
  method: 'POST', body: JSON.stringify({ operations }),
});
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ id: 'test' });
  mock.find.mockResolvedValue(null);
});
describe('sync push acknowledgements', () => {
  it('returns exact committed operation IDs', async () => {
    const result = await POST(request([operation('a'), operation('b')]));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true, applied: 2, appliedOperationIds: ['op-a', 'op-b'] });
    expect(mock.create).toHaveBeenCalledTimes(2);
  });
  it('stops at a rejected operation so retries cannot replay older changes over later ones', async () => {
    const result = await POST(request([operation('a'), { ...operation('b'), payload: {} }, operation('c')]));
    expect(result.status).toBe(409);
    expect(await result.json()).toEqual({ ok: false, applied: 1, appliedOperationIds: ['op-a'] });
    expect(mock.create).toHaveBeenCalledTimes(1);
  });
  it.each([null, { ...operation('a'), namespace: 'user:other' },
    { ...operation('a'), action: 'unknown' }, { ...operation('a'), recordId: 'different' },
  ])('does not acknowledge malformed or unauthorized operations', async (invalid) => {
    const result = await POST(request([invalid]));
    expect(result.status).toBe(409);
    expect((await result.json()).appliedOperationIds).toEqual([]);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it('rejects operations targeting another owner', async () => {
    mock.find.mockResolvedValue({ id: 'a', userId: 'other' });
    const result = await POST(request([operation('a')]));
    expect(result.status).toBe(409);
    expect((await result.json()).appliedOperationIds).toEqual([]);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('rejects oversized batches before writing', async () => {
    const result = await POST(request(Array.from({ length: 201 }, (_, i) => operation(String(i)))));
    expect(result.status).toBe(413);
    expect(mock.create).not.toHaveBeenCalled();
  });
  it('allows a retry after a lost response without creating a duplicate portfolio', async () => {
    await POST(request([operation('a')]));
    mock.find.mockResolvedValue({ id: 'a', userId: 'test' });
    const retry = await POST(request([operation('a')]));
    expect((await retry.json()).appliedOperationIds).toEqual(['op-a']);
    expect(mock.create).toHaveBeenCalledTimes(1);
    expect(mock.update).toHaveBeenCalledTimes(1);
  });
});
