import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mock = vi.hoisted(() => ({ auth: vi.fn(), owned: vi.fn(), asset: vi.fn(), create: vi.fn(), fx: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/lib/ownership', () => ({ requireAuthenticatedUser: mock.auth, findOwnedPortfolio: mock.owned }));
vi.mock('@/lib/prisma', () => ({ default: { asset: { upsert: mock.asset }, transaction: { create: mock.create } } }));
vi.mock('next/cache', () => ({ revalidatePath: mock.invalidate }));
vi.mock('@/lib/exchange-rate', () => ({ getPriceUSD: mock.fx, ExchangeRateUnavailableError: class extends Error {} }));
import { POST } from '@/app/api/transactions/route';
const body = { portfolioId: 'p', ticker: 'AAPL', type: 'BUY', quantity: 2, price: 780,
  currency: 'HKD', fee: 0, date: '2026-10-08' };
function request(overrides = {}) {
  return new NextRequest('http://localhost/api/transactions', { method: 'POST', body: JSON.stringify({ ...body, ...overrides }) });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.auth.mockResolvedValue({ id: 'user' }); mock.owned.mockResolvedValue({ id: 'p' });
  mock.asset.mockResolvedValue({ id: 'asset' }); mock.fx.mockResolvedValue({ priceUSD: 100, exchangeRate: 7.8 });
  mock.create.mockImplementation(async ({ data }) => ({ ...data, id: 'tx', asset: { ticker: 'AAPL', name: 'Apple', market: 'US' } }));
});
describe('cloud transaction creation', () => {
  it.each(['BUY', 'SELL', 'DIVIDEND'])('saves %s using owned portfolio and server FX then invalidates all views', async type => {
    const res = await POST(request({ type, quantity: type === 'DIVIDEND' ? 1 : 2, priceUSD: 999, exchangeRate: 999 }));
    expect(res.status).toBe(201);
    expect(mock.owned).toHaveBeenCalledWith('user', 'p');
    expect(mock.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      assetId: 'asset', type, priceUSD: 100, exchangeRate: 7.8,
    }) }));
    expect(mock.invalidate).toHaveBeenCalledWith('/app');
    expect(mock.invalidate).toHaveBeenCalledWith('/transactions');
    expect(mock.invalidate).toHaveBeenCalledWith('/stock/[ticker]', 'page');
  });
  it('rejects a foreign portfolio before creating shared assets or trades', async () => {
    mock.owned.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mock.asset).not.toHaveBeenCalled(); expect(mock.create).not.toHaveBeenCalled();
  });
  it.each([{ type: 'DIVIDEND', quantity: 3 }, { ticker: 'bad ticker!' }, { fee: -1 }, { price: -3 }])('rejects invalid data', async override => {
    expect((await POST(request(override))).status).toBe(400);
    expect(mock.create).not.toHaveBeenCalled();
  });
});
