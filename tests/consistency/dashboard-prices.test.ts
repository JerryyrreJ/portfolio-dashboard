import { expect, it } from 'vitest';
import { applyDashboardPrices } from '@/lib/dashboard-prices';
const summary = { totalValue: 100, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 17, totalDividendIncome: 9 };
const holding = { ticker: 'AAPL', qty: 1, price: 100, value: 100, totalCost: 100, capGain: 0, return: 0, name: 'Apple' };
it('prices the latest edited quantity while retaining realized gains and dividends', () => {
  const edited = [{ market: 'US', holdings: [{ ...holding, qty: 3, totalCost: 300 }] }];
  const result = applyDashboardPrices(edited, summary, { AAPL: 110 });
  expect(result.holdings[0].holdings[0]).toMatchObject({ name: 'Apple', qty: 3, value: 330 });
  expect(result.summary).toMatchObject({ totalValue: 330, totalCapGain: 30, totalRealizedGain: 17, totalDividendIncome: 9 });
});
it('cannot resurrect a deleted holding when an older quote arrives', () => {
  expect(applyDashboardPrices([], summary, { AAPL: 110 }).holdings).toEqual([]);
  expect(applyDashboardPrices([], summary, { AAPL: 110 }).summary.totalValue).toBe(0);
});
