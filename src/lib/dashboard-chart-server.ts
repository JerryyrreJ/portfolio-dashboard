import type { Prisma } from '@prisma/client';
import prisma, { withRetry } from '@/lib/prisma';
import { buildDashboardChartData } from '@/lib/dashboard-chart';
import { createServerProfiler } from '@/lib/perf';

function getIndexPriceHistoryDelegate() {
  const delegate = (prisma as typeof prisma & {
    indexPriceHistory?: typeof prisma.assetPriceHistory
  }).indexPriceHistory;

  return delegate && typeof delegate.findFirst === 'function' && typeof delegate.findMany === 'function'
    ? delegate
    : null;
}

function isIndexPriceHistoryUnavailable(error: unknown) {
  const prismaError = error as { code?: string; message?: string };
  const code = prismaError.code;
  const message = String(prismaError.message || '');
  return code === 'P2021' || message.includes('IndexPriceHistory');
}

const chartTransactionSelect = {
  portfolioId: true,
  type: true,
  date: true,
  quantity: true,
  price: true,
  fee: true,
  asset: {
    select: {
      ticker: true,
      name: true,
      market: true,
      lastPrice: true,
    },
  },
} satisfies Prisma.TransactionSelect;

type ChartTransactionRecord = Prisma.TransactionGetPayload<{
  select: typeof chartTransactionSelect;
}>;

export async function getDashboardChartData(
  options: {
    selectedPortfolioIds: string[];
    totalValue: number;
    transactions?: ChartTransactionRecord[];
  },
  perf = createServerProfiler('dashboard/chart-data', `pids=${options.selectedPortfolioIds.join(',')}`),
) {
  const { selectedPortfolioIds, totalValue } = options;
  if (selectedPortfolioIds.length === 0) {
    perf.flush('empty-selection');
    return [];
  }

  const transactions = options.transactions ?? await perf.time('transaction.findManyForChart', () => withRetry(() => prisma.transaction.findMany({
      where: { portfolioId: { in: selectedPortfolioIds } },
      select: chartTransactionSelect,
      orderBy: { date: 'asc' },
    }), 2, 300));

  if (transactions.length === 0) {
    perf.flush('tx=0');
    return [];
  }

  const tickers = Array.from(new Set(transactions.map((transaction) => transaction.asset.ticker)));
  const livePrices = new Map<string, number>();
  for (const transaction of transactions) {
    livePrices.set(transaction.asset.ticker, transaction.asset.lastPrice ?? transaction.price);
  }

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const priceRows = await perf.time('assetPriceHistory.findMany', () => withRetry(() => prisma.assetPriceHistory.findMany({
    where: {
      ticker: { in: tickers },
      date: { gte: oneYearAgo },
    },
    orderBy: { date: 'asc' },
    select: { ticker: true, date: true, close: true },
  }), 2, 300));

  const priceHistories: Record<string, { date: string; price: number }[]> = {};
  for (const row of priceRows) {
    const date = row.date.toISOString().split('T')[0];
    if (!priceHistories[row.ticker]) priceHistories[row.ticker] = [];
    priceHistories[row.ticker].push({ date, price: row.close });
  }

  const allDateLabels = Array.from(
    new Set(Object.values(priceHistories).flatMap((history) => history.map((point) => point.date))),
  ).sort();

  const indexPriceHistories: Record<string, { date: string; price: number }[]> = {};
  const indexPriceHistory = getIndexPriceHistoryDelegate();
  const firstChartDate = allDateLabels[0];

  if (firstChartDate && indexPriceHistory) {
    try {
      const indexRows = await perf.time('indexPriceHistory.findMany', () => withRetry(() => indexPriceHistory.findMany({
        where: {
          ticker: { in: ['SPY', 'QQQ'] },
          date: { gte: new Date(firstChartDate) },
        },
        orderBy: { date: 'asc' },
        select: { ticker: true, date: true, close: true },
      }), 2, 300));

      for (const row of indexRows) {
        const date = row.date.toISOString().split('T')[0];
        if (!indexPriceHistories[row.ticker]) indexPriceHistories[row.ticker] = [];
        indexPriceHistories[row.ticker].push({ date, price: row.close });
      }
    } catch (error) {
      if (isIndexPriceHistoryUnavailable(error)) {
        console.warn('[Dashboard Chart] Skipping benchmark series because IndexPriceHistory is not available yet.');
      } else {
        throw error;
      }
    }
  }

  const chartData = buildDashboardChartData({
    transactions: transactions.map((transaction) => ({
      portfolioId: transaction.portfolioId,
      date: transaction.date,
      type: transaction.type as 'BUY' | 'SELL' | 'DIVIDEND',
      quantity: transaction.quantity,
      price: transaction.price,
      fee: transaction.fee,
      asset: {
        ticker: transaction.asset.ticker,
        name: transaction.asset.name,
        market: transaction.asset.market,
        lastPrice: transaction.asset.lastPrice,
      },
    })),
    priceHistories,
    indexPriceHistories,
    livePrices,
    totalValue,
  });

  perf.flush(`tx=${transactions.length} chart=${chartData.length}`);
  return chartData;
}
