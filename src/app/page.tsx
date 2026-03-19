import DashboardClient from './DashboardClient'
import { getCompanyProfile } from '@/lib/finnhub'
import { get12MonthHistory } from '@/lib/twelvedata'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'


// 服务端获取实时股价（内部调用 Finnhub）
async function fetchStockQuote(symbol: string): Promise<number | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('FINNHUB_API_KEY not configured, using fallback price');
      return null;
    }

    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${apiKey}`;
    
    // 增加 abort controller 以防止长时间 hang 死
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 秒超时
    
    try {
      const response = await fetch(url, { 
        next: { revalidate: 60 },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`Failed to fetch quote for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();

      // Finnhub 返回格式: { c: 当前价格, d: 变动, dp: 变动百分比, ... }
      if (data && data.c && data.c > 0) {
        return data.c;
      }
      return null;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      console.warn(`Network error fetching quote for ${symbol}:`, fetchError.message);
      return null; // Return null so it falls back gracefully
    }
  } catch (error) {
    console.error(`Unexpected error for ${symbol}:`, error);
    return null;
  }
}

// 批量获取股票实时价格（并发，支持数据库降级）
async function fetchBatchQuotes(assets: any[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  
  // 并发请求所有价格
  const fetchPromises = assets.map(asset => 
    fetchStockQuote(asset.ticker).then(async (price) => {
      if (price) {
        prices[asset.ticker] = price;
        // 核心修复：后台异步更新，不 await，不影响主流程
        prisma.asset.update({
          where: { id: asset.id },
          data: { lastPrice: price, lastPriceUpdated: new Date() }
        }).catch(e => console.error(`Silent background update failed for ${asset.ticker}:`, e.message));
      } else {
        // 降级：优先使用数据库中的 lastPrice
        prices[asset.ticker] = asset.lastPrice || 0;
      }
    })
  );

  await Promise.allSettled(fetchPromises);
  return prices;
}

export default async function Page() {
  const user = await getUser()
  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''

  // 未登录：返回空状态，完全不查 DB
  if (!user) {
    return (
      <DashboardClient
        portfolioId="local-portfolio"
        portfolioName="My Portfolio"
        holdingsData={[]}
        chartData={[]}
        summary={{ totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0, totalRealizedGain: 0, totalDividendIncome: 0 }}
      />
    );
  }

  // 已登录：查找当前用户的 Portfolio，没有则自动创建
  let portfolio = await withRetry(() => prisma.portfolio.findFirst({
    where: { userId: user.id },
    include: {
      transactions: {
        include: { asset: true },
        orderBy: { date: 'asc' }
      }
    }
  }))

  if (!portfolio) {
    portfolio = await withRetry(() => prisma.portfolio.create({
      data: { userId: user.id, name: 'My Portfolio' },
      include: {
        transactions: {
          include: { asset: true },
          orderBy: { date: 'asc' }
        }
      }
    }))
  }

  if (portfolio.transactions.length === 0) {
    return (
      <DashboardClient
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
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
  const holdingsMap = new Map<string, any>();

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
        lots: [] as { qty: number; unitCost: number }[],
      })
    }
    const current = holdingsMap.get(ticker);

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

  // 获取唯一的 Asset 对象用于后续可能的需求
  const uniqueAssets = Array.from(
    new Map(Array.from(holdingsMap.values()).map(h => [h.asset.ticker, h.asset])).values()
  );

  // --- 核心改动：不再在此处 await fetchBatchQuotes ---
  // 我们直接使用数据库中缓存的价格进行首屏渲染
  const logoMap: Record<string, string | null> = {};
  const assetsWithLogo = Array.from(holdingsMap.values()).map(h => h.asset);
  
  // 提取需要更新的资源，后台触发，不 await
  const missingLogos = assetsWithLogo.filter(a => !a.logo);
  const assetsNeedingHistorySync = assetsWithLogo.filter(
    a => !a.historyLastUpdated || a.historyLastUpdated < new Date(Date.now() - 24 * 60 * 60 * 1000)
  );

  if (missingLogos.length > 0 || assetsNeedingHistorySync.length > 0) {
    // 异步闭包，在后台运行
    (async () => {
      try {
        for (const asset of missingLogos) {
          const profile = await getCompanyProfile(asset.ticker);
          if (profile?.logo) {
            await prisma.asset.update({ where: { id: asset.id }, data: { logo: profile.logo } });
          }
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

  const priceRows = await prisma.assetPriceHistory.findMany({
    where: {
      ticker: { in: tickers },
      date: { gte: oneYearAgo },
    },
    orderBy: { date: 'asc' },
    select: { ticker: true, date: true, close: true },
  });

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

  // 5d. 将交易记录按时间排序，用于逐日回放
  const sortedTransactions = [...portfolio.transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 5e. 对每个日期，回放交易 → 算持仓 → 乘以当日价格 → 得出该日组合市值
  const holdingsAtDate = new Map<string, number>(); // ticker → qty
  let txIndex = 0;

  const historicalChartData = allDateLabels.map(dateLabel => {
    const dayEnd = new Date(dateLabel + 'T23:59:59Z');

    // 推进交易回放：把截止当天的所有交易都计入
    while (txIndex < sortedTransactions.length && new Date(sortedTransactions[txIndex].date) <= dayEnd) {
      const t = sortedTransactions[txIndex];
      const ticker = t.asset.ticker;
      const qty = holdingsAtDate.get(ticker) ?? 0;
      if (t.type === 'BUY') holdingsAtDate.set(ticker, qty + t.quantity);
      else if (t.type === 'SELL') holdingsAtDate.set(ticker, qty - t.quantity);
      txIndex++;
    }

    let total = 0;
    for (const [ticker, qty] of holdingsAtDate) {
      if (qty <= 0) continue;
      const dayPrices = priceHistories[ticker];
      if (!dayPrices) continue;
      const point = dayPrices.find(p => p.date === dateLabel);
      if (!point) continue;
      total += qty * point.price;
    }

    return { date: dateLabel, Total: Math.round(total * 100) / 100 };
  }).filter(p => p.Total > 0);

  // 5f. 末尾追加 Today 实时数据
  const chartData = [
    ...historicalChartData,
    { date: 'Today', Total: Math.round(totalValue * 100) / 100 },
  ];

  const summary = {
    totalValue,
    totalCapGain,
    totalCapGainPercentage,
    totalRealizedGain,
    totalDividendIncome,
  };

  // 6. 将所有算好的数据作为 Props 传递给客户端组件渲染
  return (
    <DashboardClient
      portfolioId={portfolio.id}
      portfolioName={portfolio.name}
      holdingsData={holdingsData}
      chartData={chartData}
      summary={summary}
      userDisplayName={userDisplayName}
    />
  );
}