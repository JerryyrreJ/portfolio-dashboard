import type { Metadata } from "next";
import type { Asset } from "@prisma/client";
import DashboardClient from '../DashboardClient'
import { getCompanyProfile } from '@/lib/finnhub'
import { get12MonthHistory, getIndexHistory, getLogo as getTwelveDataLogo } from '@/lib/twelvedata'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
import { getPriceOnOrBefore } from '@/lib/portfolio-chart'
import { createServerProfiler } from '@/lib/perf'
import { absoluteUrl, siteConfig } from '@/lib/site'

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

type HoldingLot = {
  qty: number;
  unitCost: number;
};

type HoldingAccumulator = {
  asset: Asset;
  totalQty: number;
  totalCost: number;
  realizedGain: number;
  dividendIncome: number;
  lots: HoldingLot[];
}

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

export default async function Page({ searchParams }: { searchParams: Promise<{ pid?: string }> }) {
  const [user, { pid }] = await Promise.all([
    getUser(),
    searchParams,
  ])
  const perf = createServerProfiler('app/dashboard', pid ? `pid=${pid}` : undefined)
  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''

  // 未登录：返回空状态，完全不查 DB
  if (!user) {
    perf.flush('guest');
    return (
      <DashboardClient
        portfolioId="local-portfolio"
        portfolioName="My Portfolio"
        portfolios={[]}
        holdingsData={[]}
        chartData={[]}
        summary={{ totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 }}
      />
    );
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

  // 根据 ?pid= 选中 portfolio，找不到则 fallback 到第一个
  const selectedMeta = allPortfolios.find(p => p.id === pid) ?? allPortfolios[0]

  // 加载选中 portfolio 的完整交易数据
  let portfolio = await perf.time('portfolio.findUniqueWithTransactions', () => withRetry(() => prisma.portfolio.findUnique({
    where: { id: selectedMeta.id },
    include: {
      transactions: {
        include: { asset: true },
        orderBy: { date: 'asc' }
      }
    }
  })))

  if (!portfolio) portfolio = { ...selectedMeta, transactions: [], preferences: null, currency: 'USD', createdAt: new Date(), updatedAt: new Date(), settingsUpdatedAt: null }

  if (portfolio.transactions.length === 0) {
    perf.flush(`user=${user.id} tx=0`);
    return (
      <DashboardClient
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
        portfolios={portfolioMeta}
        holdingsData={[]}
        chartData={[]}
        summary={{ totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 }}
        userDisplayName={userDisplayName}
      />
    )
  }

  // 2. 读取用户偏好的成本计算方式
  let costBasisMethod: 'FIFO' | 'AVCO' = 'FIFO';
  if (portfolio.preferences) {
    try {
      const parsed = JSON.parse(portfolio.preferences);
      if (parsed.costBasisMethod === 'AVCO') costBasisMethod = 'AVCO';
    } catch { /* 忽略解析错误，使用默认值 */ }
  }

  // 3. 核心财务逻辑：通过历史交易流水计算实时持仓 (Holdings)
  const holdingsMap = new Map<string, HoldingAccumulator>();

  for (const t of portfolio.transactions) {
    const ticker = t.asset.ticker;
    if (!holdingsMap.has(ticker)) {
      holdingsMap.set(ticker, {
        asset: t.asset,
        totalQty: 0,
        totalCost: 0,
        realizedGain: 0,
        dividendIncome: 0,
        // FIFO 专用：买入批次队列 [{ qty, unitCost }]
        lots: [],
      })
    }
    const current = holdingsMap.get(ticker);
    if (!current) continue;

    if (t.type === 'BUY') {
      const qty = Number(t.quantity);
      const unitCost = Number(t.price) + Number(t.fee) / qty;
      current.totalQty += qty;
      current.totalCost += qty * unitCost;
      if (costBasisMethod === 'FIFO') {
        current.lots.push({ qty, unitCost });
      }
    } else if (t.type === 'SELL') {
      const sellQty = Number(t.quantity);
      const sellPrice = Number(t.price);
      const sellFee = Number(t.fee);

      if (costBasisMethod === 'FIFO') {
        // FIFO：从最早的批次开始消耗
        let remaining = sellQty;
        let costOfSold = 0;
        while (remaining > 0 && current.lots.length > 0) {
          const lot = current.lots[0];
          const consumed = Math.min(remaining, lot.qty);
          costOfSold += consumed * lot.unitCost;
          lot.qty -= consumed;
          remaining -= consumed;
          if (lot.qty <= 0) current.lots.shift();
        }
        current.realizedGain += (sellPrice * sellQty - sellFee) - costOfSold;
        current.totalQty -= sellQty;
        current.totalCost = current.lots.reduce(
          (s: number, l: { qty: number; unitCost: number }) => s + l.qty * l.unitCost, 0
        );
      } else {
        // AVCO：加权平均成本
        const avgCost = current.totalQty > 0 ? current.totalCost / current.totalQty : 0;
        current.realizedGain += (sellPrice - avgCost) * sellQty - sellFee;
        current.totalQty -= sellQty;
        current.totalCost -= avgCost * sellQty;
      }

      if (current.totalQty <= 0) {
        current.totalQty = 0;
        current.totalCost = 0;
        current.lots = [];
      }
    } else if (t.type === 'DIVIDEND') {
      const payout = Number(t.price) * Number(t.quantity);
      current.dividendIncome += payout;
    }
  }

  // 3. 计算当前市值和盈亏 (并发获取实时数据)
  let totalValue = 0;
  let totalCostBase = 0;

  // --- 核心改动：不再在此处 await fetchBatchQuotes ---
  // 我们直接使用数据库中缓存的价格进行首屏渲染
  const logoMap: Record<string, string | null> = {};
  const assetsWithLogo = Array.from(holdingsMap.values()).map(h => h.asset);
  
  // 提取需要更新的资源，后台触发，不 await
  const missingLogos = assetsWithLogo.filter(a => !a.logo);
  const assetsNeedingHistorySync = assetsWithLogo.filter(
    a => !a.historyLastUpdated || a.historyLastUpdated < new Date(Date.now() - 24 * 60 * 60 * 1000)
  );
  const indexPriceHistory = getIndexPriceHistoryDelegate();

  if (missingLogos.length > 0 || assetsNeedingHistorySync.length > 0) {
    // 异步闭包，在后台运行
    (async () => {
      try {
        const CONCURRENCY = 5;
        for (let i = 0; i < missingLogos.length; i += CONCURRENCY) {
          const batch = missingLogos.slice(i, i + CONCURRENCY);
          await Promise.allSettled(batch.map(async (asset) => {
            // Finnhub first
            const profile = await getCompanyProfile(asset.ticker);
            let logoUrl = profile?.logo || null;
            // Twelve Data fallback
            if (!logoUrl) {
              logoUrl = await getTwelveDataLogo(asset.ticker);
            }
            if (logoUrl) {
              await prisma.asset.update({ where: { id: asset.id }, data: { logo: logoUrl } });
            }
          }));
        }
        for (const asset of assetsNeedingHistorySync) {
          const history = await get12MonthHistory(asset.ticker);
          if (history && history.length > 0) {
            const values = history.map(p => `('${asset.ticker}', '${p.date}'::date, ${p.price})`).join(',');
            await prisma.$executeRawUnsafe(`
              INSERT INTO "AssetPriceHistory" (ticker, date, close)
              VALUES ${values}
              ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
            `);
            await prisma.asset.update({
              where: { id: asset.id },
              data: { historyLastUpdated: new Date() }
            });
          }
        }

        // Sync index price history (SPY, QQQ) - incremental
        if (!indexPriceHistory) {
          console.warn('[Dashboard] Prisma client is missing indexPriceHistory. Run `prisma generate` and restart `next dev`.')
        } else {
          try {
            const INDEX_TICKERS = ['SPY', 'QQQ'];
            for (const indexTicker of INDEX_TICKERS) {
              const latest = await indexPriceHistory.findFirst({
                where: { ticker: indexTicker },
                orderBy: { date: 'desc' },
                select: { date: true },
              });

              const fromDate = latest
                ? new Date(latest.date.getTime() + 86400000).toISOString().split('T')[0]
                : null;

              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              if (latest && latest.date >= yesterday) continue;

              if (!fromDate) continue; // No seed data yet, skip incremental sync

              const history = await getIndexHistory(indexTicker, fromDate);
              if (history && history.length > 0) {
                const values = history.map(p => `('${indexTicker}', '${p.date}'::date, ${p.price})`).join(',');
                await prisma.$executeRawUnsafe(`
                  INSERT INTO "IndexPriceHistory" (ticker, date, close)
                  VALUES ${values}
                  ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
                `);
              }
            }
          } catch (e) {
            if (isIndexPriceHistoryUnavailable(e)) {
              console.warn('[Dashboard] IndexPriceHistory table is not available yet. Apply the latest Prisma migration.')
            } else {
              throw e;
            }
          }
        }
      } catch (e) {
        console.error("Background cache update failed silently:", e);
      }
    })();
  }

  for (const asset of assetsWithLogo) {
    logoMap[asset.ticker] = asset.logo;
  }

  const calculatedHoldings = Array.from(holdingsMap.values()).filter(h => h.totalQty > 0).map(h => {
    const currentPrice = h.asset.lastPrice || 0;
    const value = currentPrice * h.totalQty;
    const capGain = value - h.totalCost;
    const returnPct = h.totalCost > 0 ? (capGain / h.totalCost) * 100 : 0;

    totalValue += value;
    totalCostBase += h.totalCost;

    return {
      ticker: h.asset.ticker,
      name: h.asset.name,
      market: h.asset.market,
      price: currentPrice,
      qty: h.totalQty,
      value: value,
      capGain: capGain,
      return: returnPct,
      dividendIncome: h.dividendIncome,
      logo: logoMap[h.asset.ticker],
    }
  });

  // 4. 数据按 Market 分组 (NASDAQ, NYSE, OTC)
  const markets = Array.from(new Set(calculatedHoldings.map(h => h.market)));
  const holdingsData = markets.map(m => ({
    market: m,
    holdings: calculatedHoldings.filter(h => h.market === m)
  }));

  const totalCapGain = totalValue - totalCostBase;
  const totalCapGainPercentage = totalCostBase > 0 ? (totalCapGain / totalCostBase) * 100 : 0;

  let totalRealizedGain = 0;
  let totalDividendIncome = 0;
  for (const h of holdingsMap.values()) {
    totalRealizedGain += h.realizedGain;
    totalDividendIncome += h.dividendIncome;
  }

  // 5. 时间轴走势数据 (给折线图)

  // 5a. 从 AssetPriceHistory 表读取所有持仓的日度价格（过去1年）
  const tickers = Array.from(holdingsMap.keys());
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const priceRows = await perf.time('assetPriceHistory.findMany', () => prisma.assetPriceHistory.findMany({
    where: {
      ticker: { in: tickers },
      date: { gte: oneYearAgo },
    },
    orderBy: { date: 'asc' },
    select: { ticker: true, date: true, close: true },
  }));

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
      indexPriceRows = await perf.time('indexPriceHistory.findMany', () => indexPriceHistory.findMany({
        where: {
          ticker: { in: ['SPY', 'QQQ'] },
          date: { gte: new Date(firstChartDate) },
        },
        orderBy: { date: 'asc' },
        select: { ticker: true, date: true, close: true },
      }));
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
  const sortedTransactions = [...portfolio.transactions].sort(
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

  // Compute index cumulative returns over the same date range
  const INDEX_TICKERS = ['SPY', 'QQQ'] as const;
  const indexReturnFactors: Record<string, number> = { SPY: 1.0, QQQ: 1.0 };
  const indexReturns: Record<string, number[]> = { SPY: [], QQQ: [] };

  for (let i = 0; i < allDateLabels.length; i++) {
    const dateLabel = allDateLabels[i];
    for (const idx of INDEX_TICKERS) {
      const prices = indexPriceHistories[idx];
      if (!prices || prices.length === 0) {
        indexReturns[idx].push(0);
        continue;
      }
      if (i > 0) {
        const prevLabel = allDateLabels[i - 1];
        const todayPrice = getPriceOnOrBefore(prices, dateLabel);
        const prevPrice = getPriceOnOrBefore(prices, prevLabel);
        if (todayPrice != null && prevPrice != null && prevPrice > 0) {
          indexReturnFactors[idx] *= todayPrice / prevPrice;
        }
      }
      indexReturns[idx].push(Math.round((indexReturnFactors[idx] - 1) * 10000) / 100);
    }
  }

  // Merge index returns into historical chart data points
  // We need to align by allDateLabels index, but historicalChartData is filtered (p.Total > 0)
  // Build a map from dateLabel → allDateLabels index for alignment
  const dateLabelIndexMap = new Map<string, number>();
  allDateLabels.forEach((d, i) => dateLabelIndexMap.set(d, i));

  const historicalChartDataWithIndex = historicalChartData.map((point) => {
    const i = dateLabelIndexMap.get(point.date);
    return {
      ...point,
      SPY: i != null ? (indexReturns['SPY'][i] ?? null) : null,
      QQQ: i != null ? (indexReturns['QQQ'][i] ?? null) : null,
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
      const holding = calculatedHoldings.find(h => h.ticker === ticker);
      if (prevPrice == null || !holding || prevPrice === 0) continue;
      const weight = qty * prevPrice;
      dailyFactor += (holding.price / prevPrice) * weight;
      weightSum += weight;
    }
    if (weightSum > 0) {
      todayReturnFactor *= dailyFactor / weightSum;
    }
  }

  // Index returns for Today point — carry forward the last historical value
  const todayIndexReturns: Record<string, number | null> = { SPY: null, QQQ: null };
  for (const idx of INDEX_TICKERS) {
    const lastVal = indexReturns[idx][indexReturns[idx].length - 1];
    if (lastVal != null) todayIndexReturns[idx] = lastVal;
  }

  const chartData = [
    ...historicalChartDataWithIndex,
    {
      date: 'Today',
      Total: Math.round(totalValue * 100) / 100,
      Return: Math.round((todayReturnFactor - 1) * 10000) / 100,
      SPY: todayIndexReturns['SPY'],
      QQQ: todayIndexReturns['QQQ'],
    },
  ];

  const summary = {
    totalValue,
    totalCapGain,
    totalCapGainPercentage,
    totalRealizedGain,
    totalDividendIncome,
  };

  // 6. 将所有算好的数据作为 Props 传递给客户端组件渲染
  perf.flush(`user=${user.id} tx=${portfolio.transactions.length} holdings=${holdingsMap.size} chart=${historicalChartData.length}`);
  return (
    <DashboardClient
      portfolioId={portfolio.id}
      portfolioName={portfolio.name}
      portfolios={portfolioMeta}
      holdingsData={holdingsData}
      chartData={chartData}
      summary={summary}
      userDisplayName={userDisplayName}
    />
  );
}
