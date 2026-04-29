import type React from "react";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { getLocale, getMessages } from "next-intl/server";
import DashboardPageShell from './DashboardPageShell'
import { get12MonthHistory, getIndexHistory } from '@/lib/twelvedata'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
import { getPriceOnOrBefore } from '@/lib/portfolio-chart'
import { createServerProfiler } from '@/lib/perf'
import { absoluteUrl, siteConfig } from '@/lib/site'
import {
  deriveAggregatedPortfolioDashboard,
  parseCostBasisMethod,
} from '@/lib/portfolio-aggregation'
import {
  buildPortfolioSelectionLabel,
  resolvePortfolioSelection,
} from '@/lib/portfolio-selection'

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Open the Folio dashboard to monitor holdings, transactions, and dividend performance.",
  alternates: {
    canonical: "/app",
  },
  openGraph: {
    title: `${siteConfig.name} Dashboard`,
    description: "Open the Folio dashboard to monitor holdings, transactions, and dividend performance.",
    url: absoluteUrl("/app"),
    images: [
      {
        url: absoluteUrl("/icon"),
        width: 512,
        height: 512,
        alt: `${siteConfig.name} app icon`,
      },
    ],
  },
};

const dashboardTransactionSelect = Prisma.validator<Prisma.TransactionDefaultArgs>()({
  select: {
    portfolioId: true,
    type: true,
    date: true,
    quantity: true,
    price: true,
    fee: true,
    asset: {
      select: {
        id: true,
        ticker: true,
        name: true,
        market: true,
        logo: true,
        lastPrice: true,
        historyLastUpdated: true,
      },
    },
  },
});


function getIndexPriceHistoryDelegate() {
  const delegate = (prisma as typeof prisma & {
    indexPriceHistory?: typeof prisma.assetPriceHistory
  }).indexPriceHistory
  return delegate && typeof delegate.findFirst === 'function' && typeof delegate.findMany === 'function'
    ? delegate
    : null
}

function isIndexPriceHistoryUnavailable(error: unknown) {
  const prismaError = error as { code?: string; message?: string }
  const code = prismaError.code
  const message = String(prismaError.message || '')
  return code === 'P2021' || message.includes('IndexPriceHistory')
}

function isDatabaseConnectionIssue(error: unknown) {
  const prismaError = error as { code?: string; message?: string }
  const code = prismaError.code
  const message = String(prismaError.message || '')
  return code === 'P1001'
    || code === 'P1017'
    || code === 'P1002'
    || message.includes("Can't reach database server")
    || message.includes('Connection closed')
    || message.includes('fetch failed')
}

// 进程内去重：serverless 实例重用时，多个并发请求看到同一只 ticker 需要同步，
// 不重复启动后台任务。后台任务完成后从 Map 里移除。
const inflightAssetSync = new Map<string, Promise<void>>()
const inflightIndexSync = new Map<string, Promise<void>>()

type IndexPriceHistoryDelegate = NonNullable<ReturnType<typeof getIndexPriceHistoryDelegate>>

async function runAssetHistorySync(asset: { id: string; ticker: string }): Promise<void> {
  const existing = inflightAssetSync.get(asset.ticker)
  if (existing) return existing

  const work = (async () => {
    try {
      const history = await get12MonthHistory(asset.ticker)
      const sanitized = history.filter(
        (p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.price)
      )
      if (sanitized.length === 0) return

      const rows = sanitized.map(
        (p) => Prisma.sql`(${asset.ticker}, ${p.date}::date, ${p.price})`
      )
      await prisma.$executeRaw`
        INSERT INTO "AssetPriceHistory" (ticker, date, close)
        VALUES ${Prisma.join(rows)}
        ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
      `
      await prisma.asset.update({
        where: { id: asset.id },
        data: { historyLastUpdated: new Date() },
      })
    } catch (e) {
      console.error(`[Dashboard] Background asset cache update failed for ${asset.ticker}:`, e)
    } finally {
      inflightAssetSync.delete(asset.ticker)
    }
  })()

  inflightAssetSync.set(asset.ticker, work)
  return work
}

async function runIndexHistorySync(
  indexTicker: string,
  firstChartSyncDate: string,
  indexPriceHistory: IndexPriceHistoryDelegate,
): Promise<void> {
  const existing = inflightIndexSync.get(indexTicker)
  if (existing) return existing

  const work = (async () => {
    try {
      const latest = await withRetry(() => indexPriceHistory.findFirst({
        where: { ticker: indexTicker },
        orderBy: { date: 'desc' },
        select: { date: true },
      }))

      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      if (latest && latest.date >= yesterday) return

      const fromDate = latest
        ? new Date(latest.date.getTime() + 86400000).toISOString().split('T')[0]
        : firstChartSyncDate

      const history = await getIndexHistory(indexTicker, fromDate)
      if (history.length === 0) {
        console.warn(`[Dashboard] No benchmark history returned for ${indexTicker} starting ${fromDate}.`)
        return
      }

      const sanitized = history.filter(
        (p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.price)
      )
      if (sanitized.length === 0) return

      const rows = sanitized.map(
        (p) => Prisma.sql`(${indexTicker}, ${p.date}::date, ${p.price})`
      )
      await withRetry(() => prisma.$executeRaw`
        INSERT INTO "IndexPriceHistory" (ticker, date, close)
        VALUES ${Prisma.join(rows)}
        ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
      `)
    } catch (e) {
      if (isIndexPriceHistoryUnavailable(e)) {
        console.warn('[Dashboard] IndexPriceHistory table is not available yet. Apply the latest Prisma migration.')
      } else if (isDatabaseConnectionIssue(e)) {
        console.warn('[Dashboard] Skipping background index sync because the database connection is temporarily unavailable.')
      } else {
        console.error(`[Dashboard] Background benchmark sync failed for ${indexTicker}:`, e)
      }
    } finally {
      inflightIndexSync.delete(indexTicker)
    }
  })()

  inflightIndexSync.set(indexTicker, work)
  return work
}

export default async function Page({ searchParams }: { searchParams: Promise<{ pid?: string; pids?: string }> }) {
  const [user, rawSearchParams, locale, messages] = await Promise.all([
    getUser(),
    searchParams,
    getLocale(),
    getMessages(),
  ])
  const searchSelection = rawSearchParams as { pid?: string; pids?: string }
  const pid = searchSelection.pid
  const perf = createServerProfiler('app/dashboard', pid ? `pid=${pid}` : undefined)
  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''
  const renderDashboard = (props: React.ComponentProps<typeof DashboardPageShell>['dashboardProps']) => (
    <DashboardPageShell locale={locale} messages={messages} dashboardProps={props} />
  )

  // 未登录：返回空状态，完全不查 DB
  if (!user) {
    perf.flush('guest');
    return renderDashboard({
      portfolioId: "local-portfolio",
      portfolioName: "My Portfolio",
      portfolios: [],
      initialPortfolios: [],
      selectedPortfolioIds: [],
      selectionMode: 'single',
      selectionCanWrite: true,
      isAllPortfoliosSelected: false,
      holdingsData: [],
      chartData: [],
      summary: { totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 },
      user,
    });
  }
  // 已登录：查找当前用户所有 Portfolios，没有则自动创建
  let allPortfolios = await perf.time('portfolio.findMany', () => withRetry(() => prisma.portfolio.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })))

  if (allPortfolios.length === 0) {
    const created = await perf.time('portfolio.createDefault', () => withRetry(() => prisma.portfolio.create({
      data: { userId: user.id, name: 'My Portfolio' },
    })))
    allPortfolios = [created]
  }

  const portfolioMeta = allPortfolios.map(p => ({ id: p.id, name: p.name }))
  const initialPortfolioRecords = allPortfolios.map((portfolio) => ({
    id: portfolio.id,
    name: portfolio.name,
    currency: portfolio.currency,
    preferences: portfolio.preferences,
    settingsUpdatedAt: portfolio.settingsUpdatedAt?.toISOString() ?? null,
  }))

  const selection = resolvePortfolioSelection(allPortfolios, searchSelection)
  const selectedPortfolioIds = selection.portfolioIds
  const primaryPortfolio = allPortfolios.find((portfolio) => portfolio.id === selection.primaryPortfolioId) ?? allPortfolios[0]
  const selectionLabel = buildPortfolioSelectionLabel(selection, portfolioMeta, {
    allLabel: 'All Portfolios',
    countLabel: (count) => `${count} Portfolios`,
  })

  const [transactions, initialPendingDividendCount] = await Promise.all([
    perf.time('transaction.findManyWithAsset', () => withRetry(() => prisma.transaction.findMany({
      where: { portfolioId: { in: selectedPortfolioIds } },
      ...dashboardTransactionSelect,
      orderBy: { date: 'asc' },
    }))),
    perf.time('pendingDividend.count', () => withRetry(() => prisma.pendingDividend.count({
      where: {
        portfolioId: { in: selectedPortfolioIds },
        status: 'pending',
      },
    }))),
  ])

  if (transactions.length === 0) {
    perf.flush(`user=${user.id} tx=0`);
    return renderDashboard({
      portfolioId: primaryPortfolio.id,
      portfolioName: selectionLabel,
      portfolios: portfolioMeta,
      initialPortfolios: initialPortfolioRecords,
      selectedPortfolioIds,
      selectionMode: selection.mode,
      selectionCanWrite: selection.canWrite,
      isAllPortfoliosSelected: selection.isAllSelected,
      holdingsData: [],
      chartData: [],
      summary: { totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 },
      initialPendingDividendCount,
      userDisplayName,
      user,
    })
  }

  const costBasisByPortfolio = new Map(
    allPortfolios.map((portfolio) => [portfolio.id, parseCostBasisMethod(portfolio.preferences)])
  )

  const assetsWithLogo = Array.from(
    new Map(transactions.map((transaction) => [transaction.asset.ticker, transaction.asset])).values()
  );
  const logoMap: Record<string, string | null> = {};

  // --- 核心改动：不再在此处 await fetchBatchQuotes ---
  // 我们直接使用数据库中缓存的价格进行首屏渲染
  const assetsNeedingHistorySync = assetsWithLogo.filter(
    a => !a.historyLastUpdated || a.historyLastUpdated < new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const indexPriceHistory = getIndexPriceHistoryDelegate();

  if (assetsNeedingHistorySync.length > 0) {
    // 响应发出后再继续拉取历史价格写库；同一实例内的并发请求通过 inflight Map 去重
    after(async () => {
      await Promise.all(
        assetsNeedingHistorySync.map((asset) =>
          runAssetHistorySync({ id: asset.id, ticker: asset.ticker })
        )
      )
    })
  }

  if (indexPriceHistory) {
    const firstChartSyncDate = (() => {
      const oneYearAgoDate = new Date();
      oneYearAgoDate.setFullYear(oneYearAgoDate.getFullYear() - 1);
      return oneYearAgoDate.toISOString().split('T')[0];
    })();

    const indexDelegate = indexPriceHistory;
    after(async () => {
      const INDEX_TICKERS = ['SPY', 'QQQ'] as const;
      await Promise.all(
        INDEX_TICKERS.map((indexTicker) =>
          runIndexHistorySync(indexTicker, firstChartSyncDate, indexDelegate)
        )
      );
    });
  } else {
    console.warn('[Dashboard] Prisma client is missing indexPriceHistory. Run `prisma generate` and restart `next dev`.')
  }

  for (const asset of assetsWithLogo) {
    logoMap[asset.ticker] = asset.logo;
  }

  const derivedDashboard = deriveAggregatedPortfolioDashboard(
    transactions.map((transaction) => ({
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
  )

  const holdingsData = derivedDashboard.holdings.map((group) => ({
    market: group.market,
    holdings: group.holdings.map((holding) => ({
      ...holding,
      logo: logoMap[holding.ticker] ?? holding.logo ?? null,
    })),
  }))

  const summary = derivedDashboard.summary
  const holdingPriceByTicker = new Map(
    holdingsData.flatMap((group) => group.holdings.map((holding) => [holding.ticker, holding.price] as const))
  )

  // 5. 时间轴走势数据 (给折线图)

  // 5a. 从 AssetPriceHistory 表读取所有持仓的日度价格（过去1年）
  const tickers = Array.from(new Set(transactions.map((transaction) => transaction.asset.ticker)));
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const priceRows = await perf.time('assetPriceHistory.findMany', () => withRetry(() => prisma.assetPriceHistory.findMany({
    where: {
      ticker: { in: tickers },
      date: { gte: oneYearAgo },
    },
    orderBy: { date: 'asc' },
    select: { ticker: true, date: true, close: true },
  })));

  // 5b. 按 ticker 分组，date 转为 YYYY-MM-DD 字符串
  const priceHistories: Record<string, { date: string; price: number }[]> = {};
  for (const row of priceRows) {
    const dateStr = row.date.toISOString().split('T')[0];
    if (!priceHistories[row.ticker]) priceHistories[row.ticker] = [];
    priceHistories[row.ticker].push({ date: dateStr, price: row.close });
  }

  // 5c. 收集所有出现过的日期标签，按时间排序
  const allDateLabels = Array.from(
    new Set(Object.values(priceHistories).flatMap(h => h.map(p => p.date)))
  ).sort();

  // Fetch index price history covering the same date range
  const firstChartDate = allDateLabels[0];
  let indexPriceRows: { ticker: string; date: Date; close: number }[] = [];

  if (firstChartDate && indexPriceHistory) {
    try {
      indexPriceRows = await perf.time('indexPriceHistory.findMany', () => withRetry(() => indexPriceHistory.findMany({
        where: {
          ticker: { in: ['SPY', 'QQQ'] },
          date: { gte: new Date(firstChartDate) },
        },
        orderBy: { date: 'asc' },
        select: { ticker: true, date: true, close: true },
      })));
    } catch (e) {
      if (isIndexPriceHistoryUnavailable(e)) {
        console.warn('[Dashboard] Skipping benchmark series because IndexPriceHistory is not available yet.')
      } else {
        throw e;
      }
    }
  }

  const indexPriceHistories: Record<string, { date: string; price: number }[]> = {};
  for (const row of indexPriceRows) {
    const dateStr = row.date.toISOString().split('T')[0];
    if (!indexPriceHistories[row.ticker]) indexPriceHistories[row.ticker] = [];
    indexPriceHistories[row.ticker].push({ date: dateStr, price: row.close });
  }

  // 5d. 将交易记录按时间排序，用于逐日回放
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 5e. 对每个日期，回放交易 → 算持仓 → 乘以当日价格 → 得出该日组合市值
  const holdingsAtDate = new Map<string, number>(); // ticker → qty
  let txIndex = 0;
  let cumulativeReturnFactor = 1.0;

  const historicalChartData = allDateLabels.map((dateLabel, i) => {
    const dayEnd = new Date(dateLabel + 'T23:59:59Z');

    // 在推进交易之前先快照持仓（用于 TWR 权重计算）
    const holdingsBeforeTx = new Map(holdingsAtDate);

    // 推进交易回放：把截止当天的所有交易都计入
    while (txIndex < sortedTransactions.length && new Date(sortedTransactions[txIndex].date) <= dayEnd) {
      const t = sortedTransactions[txIndex];
      const ticker = t.asset.ticker;
      const qty = holdingsAtDate.get(ticker) ?? 0;
      if (t.type === 'BUY') holdingsAtDate.set(ticker, qty + t.quantity);
      else if (t.type === 'SELL') holdingsAtDate.set(ticker, qty - t.quantity);
      txIndex++;
    }

    // 当天收盘市值（用交易后持仓）
    let total = 0;
    for (const [ticker, qty] of holdingsAtDate) {
      if (qty <= 0) continue;
      const dayPrices = priceHistories[ticker];
      if (!dayPrices) continue;
      const price = getPriceOnOrBefore(dayPrices, dateLabel);
      if (price == null) continue;
      total += qty * price;
    }

    // TWR 日收益率：用交易前的持仓权重 × (今天价格 / 昨天价格)
    // 这样加仓/减仓完全不影响当天的收益率，只影响之后的权重
    if (i > 0) {
      const prevLabel = allDateLabels[i - 1];
      let dailyFactor = 0;
      let weightSum = 0;
      for (const [ticker, qty] of holdingsBeforeTx) {
        if (qty <= 0) continue;
        const dayPrices = priceHistories[ticker];
        if (!dayPrices) continue;
        const todayPrice = getPriceOnOrBefore(dayPrices, dateLabel);
        const prevPrice = getPriceOnOrBefore(dayPrices, prevLabel);
        if (todayPrice == null || prevPrice == null || prevPrice === 0) continue;
        const weight = qty * prevPrice;
        dailyFactor += (todayPrice / prevPrice) * weight;
        weightSum += weight;
      }
      if (weightSum > 0) {
        cumulativeReturnFactor *= dailyFactor / weightSum;
      }
    }

    return {
      date: dateLabel,
      Total: Math.round(total * 100) / 100,
      Return: Math.round((cumulativeReturnFactor - 1) * 10000) / 100,
    };
  }).filter(p => p.Total > 0);

  // Compute index cumulative returns over the same visible portfolio history range.
  // Anchor every benchmark to the portfolio's first chart day (falling back to the
  // earliest available index price) so the comparison line starts at 0% on the same
  // date as the portfolio line, no matter when index history happens to begin.
  const INDEX_TICKERS = ['SPY', 'QQQ'] as const;
  const indexReturnsByDate = new Map<string, { SPY: number | null; QQQ: number | null }>();

  const firstChartLabel = historicalChartData[0]?.date;
  const indexBaselinePrices: Record<string, number | null> = { SPY: null, QQQ: null };

  if (firstChartLabel) {
    for (const idx of INDEX_TICKERS) {
      const prices = indexPriceHistories[idx];
      if (!prices || prices.length === 0) continue;
      const baseline = getPriceOnOrBefore(prices, firstChartLabel) ?? prices[0]?.price ?? null;
      if (baseline != null && baseline > 0) {
        indexBaselinePrices[idx] = baseline;
      }
    }
  }

  for (let i = 0; i < historicalChartData.length; i++) {
    const dateLabel = historicalChartData[i].date;
    const pointReturns: { SPY: number | null; QQQ: number | null } = { SPY: null, QQQ: null };

    for (const idx of INDEX_TICKERS) {
      const baseline = indexBaselinePrices[idx];
      const prices = indexPriceHistories[idx];
      if (baseline == null || !prices || prices.length === 0) continue;

      const todayPrice = getPriceOnOrBefore(prices, dateLabel);
      if (todayPrice == null || todayPrice <= 0) continue;

      pointReturns[idx] = Math.round((todayPrice / baseline - 1) * 10000) / 100;
    }

    indexReturnsByDate.set(dateLabel, pointReturns);
  }

  const historicalChartDataWithIndex = historicalChartData.map((point) => {
    const pointReturns = indexReturnsByDate.get(point.date);
    return {
      ...point,
      SPY: pointReturns?.SPY ?? null,
      QQQ: pointReturns?.QQQ ?? null,
    };
  });

  // 5f. 末尾追加 Today 实时数据
  // Today 的 TWR：用最后一个历史日的价格作为昨天
  const lastHistorical = historicalChartDataWithIndex[historicalChartDataWithIndex.length - 1];
  let todayReturnFactor = cumulativeReturnFactor;
  if (lastHistorical) {
    const lastLabel = lastHistorical.date;
    let dailyFactor = 0;
    let weightSum = 0;
    for (const [ticker, qty] of holdingsAtDate) {
      if (qty <= 0) continue;
      const dayPrices = priceHistories[ticker];
      if (!dayPrices) continue;
      const prevPrice = getPriceOnOrBefore(dayPrices, lastLabel);
      // 今天实时价格从 holdingsData 里取
      const livePrice = holdingPriceByTicker.get(ticker);
      if (prevPrice == null || livePrice == null || prevPrice === 0) continue;
      const weight = qty * prevPrice;
      dailyFactor += (livePrice / prevPrice) * weight;
      weightSum += weight;
    }
    if (weightSum > 0) {
      todayReturnFactor *= dailyFactor / weightSum;
    }
  }

  // Index returns for Today point — carry forward the last historical value
  const todayIndexReturns: Record<string, number | null> = { SPY: null, QQQ: null };
  for (const idx of INDEX_TICKERS) {
    const lastVal = historicalChartDataWithIndex[historicalChartDataWithIndex.length - 1]?.[idx] ?? null;
    if (lastVal != null) todayIndexReturns[idx] = lastVal;
  }

  const chartData = [
    ...historicalChartDataWithIndex,
    {
      date: 'Today',
      Total: Math.round(summary.totalValue * 100) / 100,
      Return: Math.round((todayReturnFactor - 1) * 10000) / 100,
      SPY: todayIndexReturns['SPY'],
      QQQ: todayIndexReturns['QQQ'],
    },
  ];

  // 6. 将所有算好的数据作为 Props 传递给客户端组件渲染
  perf.flush(`user=${user.id} tx=${transactions.length} holdings=${holdingsData.reduce((sum, group) => sum + group.holdings.length, 0)} chart=${historicalChartData.length}`);
  return renderDashboard({
    portfolioId: primaryPortfolio.id,
    portfolioName: selectionLabel,
    portfolios: portfolioMeta,
    initialPortfolios: initialPortfolioRecords,
    selectedPortfolioIds,
    selectionMode: selection.mode,
    selectionCanWrite: selection.canWrite,
    isAllPortfoliosSelected: selection.isAllSelected,
    holdingsData,
    chartData,
    summary,
    initialPendingDividendCount,
    userDisplayName,
    user,
  });
}
