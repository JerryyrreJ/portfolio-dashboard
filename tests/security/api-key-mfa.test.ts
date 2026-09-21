import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  getSession: vi.fn(), getUser: vi.fn(), getClaims: vi.fn(),
  keyCount: vi.fn(), keyCreate: vi.fn(), portfolioFind: vi.fn(), rateLimit: vi.fn(),
}));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: {
  getSession: mock.getSession, getUser: mock.getUser, getClaims: mock.getClaims,
} }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@/lib/prisma', () => ({ default: {
  apiKey: { count: mock.keyCount, create: mock.keyCreate },
  portfolio: { findMany: mock.portfolioFind },
} }));
vi.mock('@/lib/rate-limit', () => ({ applyRateLimit: mock.rateLimit }));
import { POST } from '@/app/api/settings/api-keys/route';
import { GET as getPortfolios } from '@/app/api/portfolio/route';

beforeEach(() => {
  vi.clearAllMocks();
  mock.getSession.mockResolvedValue({ data: { session: { access_token: 'token' } }, error: null });
  mock.getUser.mockResolvedValue({ data: { user: { id: 'user', factors: [{ status: 'verified' }] } }, error: null });
  mock.getClaims.mockResolvedValue({ data: { claims: { sub: 'user', aal: 'aal1' } }, error: null });
  mock.rateLimit.mockResolvedValue({ allowed: true, headers: {} });
  mock.keyCount.mockResolvedValue(0);
  mock.keyCreate.mockResolvedValue({ id: 'key', name: 'test', prefix: 'folio_sk_test', lastFour: '1234', createdAt: new Date(), lastUsedAt: null });
});
const request = () => new NextRequest('https://example.test/api/settings/api-keys', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'test' }),
});

describe('MFA protection through real route and shared server auth wiring', () => {
  it('prevents AAL1 from creating an API key without touching the database', async () => {
    expect((await POST(request())).status).toBe(401);
    expect(mock.keyCount).not.toHaveBeenCalled();
    expect(mock.keyCreate).not.toHaveBeenCalled();
  });
  it('protects the portfolio route that previously had separate auth', async () => {
    expect((await getPortfolios()).status).toBe(401);
    expect(mock.portfolioFind).not.toHaveBeenCalled();
  });
  it('allows AAL2 to create a hashed key and return the secret once', async () => {
    mock.getClaims.mockResolvedValue({ data: { claims: { sub: 'user', aal: 'aal2' } }, error: null });
    const response = await POST(request());
    expect(response.status).toBe(201);
    const { key } = await response.json();
    const data = mock.keyCreate.mock.calls[0][0].data;
    expect(key.secret).toMatch(/^folio_sk_[a-f0-9]{64}$/);
    expect(data.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data).not.toHaveProperty('secret');
    expect(key).not.toHaveProperty('keyHash');
  });
});
