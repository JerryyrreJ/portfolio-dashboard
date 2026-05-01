import { NextResponse } from 'next/server';
import { createServerProfiler } from '@/lib/perf';
import prisma, { withRetry } from '@/lib/prisma';
import { getUserWithOptions } from '@/lib/supabase-server';
import { getDashboardChartData } from '@/lib/dashboard-chart-server';
import { resolvePortfolioSelection } from '@/lib/portfolio-selection';
import { deriveAggregatedPortfolioDashboard, parseCostBasisMethod } from '@/lib/portfolio-aggregation';

export async function GET(request: Request) {
  const perf = createServerProfiler('api/dashboard/chart');

  try {
    const user = await perf.time('getUser', () => getUserWithOptions({ retries: 1, delayMs: 150 }));
    if (!user) {
      perf.flush('guest');
      return NextResponse.json({ chartData: [] });
    }

    const url = new URL(request.url);
    const portfolios = await perf.time('portfolio.findMany', () => withRetry(() => prisma.portfolio.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        preferences: true,
      },
    }), 2, 300));

    const selection = resolvePortfolioSelection(portfolios, {
      pid: url.searchParams.get('pid'),
      pids: url.searchParams.get('pids'),
    });

    if (selection.portfolioIds.length === 0) {
      perf.flush('no-portfolios');
      return NextResponse.json({ chartData: [] });
    }

    const summaryTransactions = await perf.time('transaction.findManyForSummary', () => withRetry(() => prisma.transaction.findMany({
      where: { portfolioId: { in: selection.portfolioIds } },
      select: {
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
            logo: true,
            lastPrice: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    }), 2, 300));

    const costBasisByPortfolio = new Map(
      portfolios.map((portfolio) => [portfolio.id, parseCostBasisMethod(portfolio.preferences)]),
    );

    const derivedDashboard = deriveAggregatedPortfolioDashboard(
      summaryTransactions.map((transaction) => ({
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
          logo: transaction.asset.logo,
          lastPrice: transaction.asset.lastPrice,
        },
      })),
      {
        getCostBasisMethodForPortfolio: (portfolioId) => costBasisByPortfolio.get(portfolioId) ?? 'FIFO',
      },
    );

    const chartData = await getDashboardChartData({
      selectedPortfolioIds: selection.portfolioIds,
      totalValue: derivedDashboard.summary.totalValue,
      transactions: summaryTransactions,
    }, perf);
    perf.flush(`user=${user.id} chart=${chartData.length}`);
    return NextResponse.json({ chartData });
  } catch (error) {
    console.error('Failed to load dashboard chart data:', error);
    perf.flush('error');
    return NextResponse.json({ error: 'Failed to load dashboard chart data' }, { status: 500 });
  }
}
