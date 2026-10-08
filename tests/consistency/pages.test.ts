// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
const mock = vi.hoisted(() => ({ refresh: vi.fn(), ledger: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mock.refresh, push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useLocale: () => 'en', useTranslations: () => (key: string) => key }));
vi.mock('@/lib/useCurrency', () => ({ useCurrency: () => ({ symbol: '$', convert: (n: number) => n, fmt: (n: number) => String(n) }) }));
vi.mock('@/lib/usePreferences', () => ({ usePreferences: () => ({ prefs: { costBasisMethod: 'FIFO' }, colors: {
  gain: { hex: '#0f0', tailwind: { text: '', bgLight: '' } }, loss: { hex: '#f00', tailwind: { text: '', bgLight: '' } },
} }) }));
vi.mock('@/lib/ledger/react', () => ({ usePortfolioDashboard: mock.ledger }));
vi.mock('@/app/components/AddTransactionModal', () => ({ default: () => null }));
vi.mock('@/app/components/GlobalSearch', () => ({ default: () => null }));
vi.mock('@/app/components/PortfolioSwitcher', () => ({ default: () => null }));
vi.mock('@/app/components/DividendConfirmationModal', () => ({ default: () => null }));
vi.mock('@/app/components/CachedAssetLogo', () => ({ default: () => null }));
vi.mock('@/app/components/PendingNavLink', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('recharts', () => Object.fromEntries(['AreaChart', 'Area', 'Line', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'ResponsiveContainer', 'ReferenceLine', 'Legend'].map(key => [key, () => null])));
import Dashboard from '@/app/DashboardClient';
import Transactions from '@/app/transactions/TransactionsClient';
const summary = { totalValue: 100, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 };
const holding = (ticker: string) => ({ market: 'US', holdings: [{ ticker, name: ticker, price: 100, qty: 1, value: 100, totalCost: 100, capGain: 0, return: 0, market: 'US' }] });
const dashboardProps = { portfolioId: 'p', portfolioName: 'Cloud', portfolios: [{ id: 'p', name: 'Cloud' }], holdingsData: [holding('CLOUD')], chartData: [], summary };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('logged-in Dashboard ignores a populated stale local ledger, including after deletion of the last cloud holding', () => {
  mock.ledger.mockReturnValue({ activePortfolioId: 'old', portfolios: [{ id: 'old', name: 'STALE' }], ready: true,
    transactions: [{ id: 'old' }], holdings: [holding('STALE')], summary, hasPendingSync: false });
  const props = { ...dashboardProps, user: { id: 'user' } as User };
  const html = renderToStaticMarkup(React.createElement(Dashboard, props));
  expect(html).toContain('CLOUD'); expect(html).not.toContain('STALE');
  const empty = renderToStaticMarkup(React.createElement(Dashboard, { ...props, holdingsData: [] }));
  expect(empty).not.toContain('STALE'); expect(empty).not.toContain('CLOUD');
});
it('guest Dashboard continues to display its local holdings', () => {
  mock.ledger.mockReturnValue({ activePortfolioId: 'local', portfolios: [], ready: true,
    transactions: [], holdings: [holding('LOCAL')], summary, hasPendingSync: false });
  const html = renderToStaticMarkup(React.createElement(Dashboard, { ...dashboardProps, user: null }));
  expect(html).toContain('LOCAL'); expect(html).not.toContain('CLOUD');
});
it('transaction list replaces client state when refreshed server props change, including an empty list', () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const row = { id: 'tx', type: 'BUY', quantity: 1, price: 100, priceUSD: 100, fee: 0, currency: 'USD',
    date: new Date('2026-10-08'), asset: { id: 'a', ticker: 'BEFORE', name: 'Before', market: 'US' }, portfolio: { id: 'p', name: 'Cloud' } };
  const props = { transactions: [row], total: 1, totalPages: 1, currentPage: 1, limit: 20,
    portfolioId: 'p', portfolioName: 'Cloud', initialPortfolios: [], logoMap: {}, buyCount: 1, sellCount: 0, totalVolume: 100 };
  const result = render(React.createElement(Transactions, props));
  expect(result.container.textContent).toContain('BEFORE');
  result.rerender(React.createElement(Transactions, { ...props, transactions: [{ ...row, asset: { ...row.asset, ticker: 'AFTER' } }] }));
  expect(result.container.textContent).toContain('AFTER'); expect(result.container.textContent).not.toContain('BEFORE');
  result.rerender(React.createElement(Transactions, { ...props, transactions: [], total: 0 }));
  expect(result.container.textContent).not.toContain('AFTER');
});

it('does not refetch quotes when recalculating guest holdings after a quote arrives', async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, headers: new Headers(), json: async () => ({ LOCAL: 110 }) });
  vi.stubGlobal('fetch', fetchMock);
  mock.ledger.mockImplementation(() => ({ activePortfolioId: 'local', portfolios: [], ready: true,
    transactions: [], holdings: [holding('LOCAL')], summary, hasPendingSync: false }));
  render(React.createElement(Dashboard, { ...dashboardProps, user: null }));
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
