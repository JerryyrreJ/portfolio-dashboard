import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const prismaMock = vi.hoisted(() => ({
  portfolio: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  transaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  asset: {
    upsert: vi.fn(),
  },
}));

const ownershipMock = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/ownership', () => ownershipMock);

import { POST } from '@/app/api/sync/push/route';

describe('POST /api/sync/push ownership protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownershipMock.requireAuthenticatedUser.mockResolvedValue({ id: 'user-a' });

    prismaMock.portfolio.findFirst.mockResolvedValue({ id: 'portfolio-a' });
    prismaMock.portfolio.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.transaction.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.asset.upsert.mockResolvedValue({ id: 'asset-1' });
  });

  it('rejects portfolio update when target portfolio belongs to another user', async () => {
    prismaMock.portfolio.findUnique.mockResolvedValue({ id: 'portfolio-b', userId: 'user-b' });

    const request = new NextRequest('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          {
            id: 'op-1',
            namespace: 'user:user-a',
            entity: 'portfolio',
            action: 'upsert',
            recordId: 'portfolio-b',
            payload: {
              id: 'portfolio-b',
              name: 'Hacked Name',
              currency: 'USD',
            },
            updatedAt: '2026-04-27T10:00:00.000Z',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ ok: false, applied: 0, appliedOperationIds: [] });
    expect(prismaMock.portfolio.update).not.toHaveBeenCalled();
    expect(prismaMock.portfolio.create).not.toHaveBeenCalled();
  });

  it('rejects transaction update when target transaction belongs to another user', async () => {
    prismaMock.portfolio.findUnique.mockResolvedValue({ id: 'portfolio-a', userId: 'user-a' });
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-foreign',
      portfolio: { userId: 'user-b' },
    });

    const request = new NextRequest('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          {
            id: 'op-2',
            namespace: 'user:user-a',
            entity: 'transaction',
            action: 'upsert',
            recordId: 'tx-foreign',
            payload: {
              id: 'tx-foreign',
              portfolioId: 'portfolio-a',
              type: 'BUY',
              date: '2026-04-27T10:00:00.000Z',
              quantity: 1,
              price: 100,
              priceUSD: 100,
              exchangeRate: 1,
              fee: 0,
              currency: 'USD',
              asset: {
                ticker: 'AAPL',
                name: 'Apple',
                market: 'US',
                currency: 'USD',
              },
            },
            updatedAt: '2026-04-27T10:01:00.000Z',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({ ok: false, applied: 0, appliedOperationIds: [] });
    expect(prismaMock.transaction.update).not.toHaveBeenCalled();
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it('does not trust client-provided asset metadata during transaction sync', async () => {
    prismaMock.portfolio.findUnique.mockResolvedValue({ id: 'portfolio-a', userId: 'user-a' });
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-new' });

    const request = new NextRequest('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          {
            id: 'op-asset',
            namespace: 'user:user-a',
            entity: 'transaction',
            action: 'upsert',
            recordId: 'tx-new',
            payload: {
              id: 'tx-new',
              portfolioId: 'portfolio-a',
              type: 'BUY',
              date: '2026-04-27T10:00:00.000Z',
              quantity: 1,
              price: 100,
              priceUSD: 100,
              exchangeRate: 1,
              fee: 0,
              currency: 'USD',
              asset: {
                ticker: 'aapl',
                name: 'Injected Name',
                market: 'HK',
                currency: 'HKD',
                logo: 'https://evil.example/logo.png',
              },
            },
            updatedAt: '2026-04-27T10:03:00.000Z',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, applied: 1, appliedOperationIds: ['op-asset'] });
    expect(prismaMock.asset.upsert).toHaveBeenCalledWith({
      where: { ticker: 'AAPL' },
      create: {
        ticker: 'AAPL',
        name: 'AAPL',
        market: 'US',
        currency: 'USD',
      },
      update: {},
      select: { id: true, ticker: true, name: true, market: true, currency: true },
    });
  });

  it('allows updating own portfolio and own transaction', async () => {
    prismaMock.portfolio.findUnique.mockResolvedValue({ id: 'portfolio-a', userId: 'user-a' });
    prismaMock.transaction.findUnique.mockResolvedValue({
      id: 'tx-a',
      portfolio: { userId: 'user-a' },
    });
    prismaMock.portfolio.update.mockResolvedValue({ id: 'portfolio-a' });
    prismaMock.transaction.update.mockResolvedValue({ id: 'tx-a' });

    const request = new NextRequest('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({
        operations: [
          {
            id: 'op-3',
            namespace: 'user:user-a',
            entity: 'portfolio',
            action: 'upsert',
            recordId: 'portfolio-a',
            payload: {
              id: 'portfolio-a',
              name: 'My Portfolio',
              currency: 'USD',
            },
            updatedAt: '2026-04-27T10:02:00.000Z',
          },
          {
            id: 'op-4',
            namespace: 'user:user-a',
            entity: 'transaction',
            action: 'upsert',
            recordId: 'tx-a',
            payload: {
              id: 'tx-a',
              portfolioId: 'portfolio-a',
              type: 'BUY',
              date: '2026-04-27T10:02:10.000Z',
              quantity: 2,
              price: 120,
              priceUSD: 120,
              exchangeRate: 1,
              fee: 0,
              currency: 'USD',
              asset: {
                ticker: 'AAPL',
                name: 'Apple',
                market: 'US',
                currency: 'USD',
              },
            },
            updatedAt: '2026-04-27T10:02:10.000Z',
          },
        ],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, applied: 2, appliedOperationIds: ['op-3', 'op-4'] });
    expect(prismaMock.portfolio.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.transaction.update).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized operations payload', async () => {
    const operations = Array.from({ length: 201 }, (_, idx) => ({
      id: `op-${idx}`,
      namespace: 'user:user-a',
      entity: 'portfolio',
      action: 'upsert',
      recordId: `portfolio-${idx}`,
      payload: {
        id: `portfolio-${idx}`,
        name: `Portfolio ${idx}`,
        currency: 'USD',
      },
      updatedAt: '2026-04-27T10:00:00.000Z',
    }));

    const request = new NextRequest('http://localhost/api/sync/push', {
      method: 'POST',
      body: JSON.stringify({ operations }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(413);
    expect(payload).toEqual({
      error: 'Too many operations in one request (max 200)',
    });
    expect(prismaMock.portfolio.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findUnique).not.toHaveBeenCalled();
  });
});
