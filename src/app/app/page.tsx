import type React from "react";
import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { after } from "next/server";
import { getLocale, getMessages } from "next-intl/server";
import DashboardPageShell from './DashboardPageShell'
import { get12MonthHistory, getIndexHistory } from '@/lib/twelvedata'
import { getUserWithOptions } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
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
      yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const yesterdayLabel = yesterday.toISOString().split('T')[0]
      const latestLabel = latest?.date.toISOString().split('T')[0] ?? null

      if (latestLabel && latestLabel >= yesterdayLabel) return

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
    getUserWithOptions({ retries: 1, delayMs: 150 }),
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
  }), 2, 300))

  if (allPortfolios.length === 0) {
    const created = await perf.time('portfolio.createDefault', () => withRetry(() => prisma.portfolio.create({
      data: { userId: user.id, name: 'My Portfolio' },
    }), 2, 300))
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
    }), 2, 300)),
    perf.time('pendingDividend.count', () => withRetry(() => prisma.pendingDividend.count({
      where: {
        portfolioId: { in: selectedPortfolioIds },
        status: 'pending',
      },
    }), 2, 300)),
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

  // 6. 将所有算好的数据作为 Props 传递给客户端组件渲染
  perf.flush(`user=${user.id} tx=${transactions.length} holdings=${holdingsData.reduce((sum, group) => sum + group.holdings.length, 0)} chart=deferred`);
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
    chartData: [],
    summary,
    initialPendingDividendCount,
    userDisplayName,
    user,
  });
}
