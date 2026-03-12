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

  // 未登录：返回空状态，完全不查 DB
  if (!user) {
    return (
      <DashboardClient
        portfolioId="local-portfolio"
        portfolioName="My Portfolio"
        holdingsData={[]}
        chartData={[]}
        summary={{ totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0 }}
      />
    );
  }

  // 已登录：查找当前用户的 Portfolio，没有则自动创建
  let portfolio = await withRetry(() => prisma.portfolio.findFirst({
    where: { userId: user.id },
    include: {
      transactions: {
        include: { asset: true }
      }
    }
  }))

  if (!portfolio) {
    portfolio = await withRetry(() => prisma.portfolio.create({
      data: { userId: user.id, name: 'My Portfolio' },
      include: {
        transactions: {
          include: { asset: true }
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
        summary={{ totalValue: 0, totalCapGain: 0, totalCapGainPercentage: 0 }}
      />
    )
  }

  // 2. 核心财务逻辑：通过历史交易流水计算实时持仓 (Holdings)
  const holdingsMap = new Map<string, any>();

  for (const t of portfolio.transactions) {
    const ticker = t.asset.ticker;
    if (!holdingsMap.has(ticker)) {
      holdingsMap.set(ticker, {
        asset: t.asset,
        totalQty: 0,
        totalCost: 0, 
      })
    }
    const current = holdingsMap.get(ticker);
    
    if (t.type === 'BUY') {
      current.totalQty += t.quantity;
      current.totalCost += (t.price * t.quantity) + t.fee;
    } else if (t.type === 'SELL') {
      const avgCost = current.totalQty > 0 ? current.totalCost / current.totalQty : 0;
      current.totalQty -= t.quantity;
      current.totalCost -= avgCost * t.quantity;
      if (current.totalQty <= 0) {
        current.totalQty = 0;
        current.totalCost = 0;
      }
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
  const missingHistories = assetsWithLogo.filter(a => !a.priceHistory);

  if (missingLogos.length > 0 || missingHistories.length > 0) {
    // 异步闭包，在后台运行
    (async () => {
      try {
        for (const asset of missingLogos) {
          const profile = await getCompanyProfile(asset.ticker);
          if (profile?.logo) {
            await prisma.asset.update({ where: { id: asset.id }, data: { logo: profile.logo } });
          }
        }
        for (const asset of missingHistories) {
          const history = await get12MonthHistory(asset.ticker);
          if (history && history.length > 0) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { priceHistory: JSON.stringify(history), historyLastUpdated: new Date() }
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

  const calculatedHoldings = Array.from(holdingsMap.values()).map(h => {
    // 使用数据库缓存的价格，如果没有则用 fallback
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

  // 5. 时间轴走势数据 (给折线图)

  // 5a. 确保每个 Asset 都有 priceHistory 缓存（没有就拉取并存入 DB）
  // 已经移至后台异步更新 (第4步)，不在此处阻塞页面加载

  // 5b. 解析各 Asset 的历史价格
  const priceHistories: Record<string, { date: string; price: number }[]> = {};
  for (const asset of assetsWithLogo) {
    if (asset.priceHistory) {
      try {
        priceHistories[asset.ticker] = JSON.parse(asset.priceHistory);
      } catch { /* ignore */ }
    }
  }

  // 5c. 收集所有 Asset 历史中出现过的月份标签，按时间排序
  const allDateLabels = Array.from(
    new Set(Object.values(priceHistories).flatMap(h => h.map(p => p.date)))
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // 5d. 将交易记录按时间排序，用于逐月回放
  const sortedTransactions = [...portfolio.transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 5e. 对每个月份标签，回放交易 → 算持仓 → 乘以当月价格 → 得出该月组合市值
  const historicalChartData = allDateLabels.map(dateLabel => {
    // "Mar 2025" → 该月月底，确保当月内的所有交易都被计入
    const labelDate = new Date(dateLabel);
    const endOfMonth = new Date(labelDate.getFullYear(), labelDate.getMonth() + 1, 0, 23, 59, 59);

    const holdingsAtDate = new Map<string, { qty: number; market: string }>();
    for (const t of sortedTransactions) {
      if (new Date(t.date) > endOfMonth) break;
      const ticker = t.asset.ticker;
      if (!holdingsAtDate.has(ticker)) {
        holdingsAtDate.set(ticker, { qty: 0, market: t.asset.market });
      }
      const h = holdingsAtDate.get(ticker)!;
      if (t.type === 'BUY') h.qty += t.quantity;
      else if (t.type === 'SELL') h.qty -= t.quantity;
    }

    let nasdaq = 0, nyse = 0, otc = 0;
    for (const [ticker, holding] of holdingsAtDate) {
      if (holding.qty <= 0) continue;
      const assetHistory = priceHistories[ticker] ?? [];
      const pricePoint = assetHistory.find(p => p.date === dateLabel);
      if (!pricePoint) continue;
      const value = holding.qty * pricePoint.price;
      if (holding.market === 'NASDAQ') nasdaq += value;
      else if (holding.market === 'NYSE') nyse += value;
      else if (holding.market === 'OTC') otc += value;
    }

    return {
      date: dateLabel,
      NASDAQ: Math.round(nasdaq),
      NYSE: Math.round(nyse),
      OTC: Math.round(otc),
    };
  });

  // 5f. 末尾追加 Today 实时数据
  const todayOTC = calculatedHoldings.filter(h=>h.market==='OTC').reduce((s,h)=>s+h.value,0);
  const todayNASDAQ = calculatedHoldings.filter(h=>h.market==='NASDAQ').reduce((s,h)=>s+h.value,0);
  const todayNYSE = calculatedHoldings.filter(h=>h.market==='NYSE').reduce((s,h)=>s+h.value,0);

  const chartData = [
    ...historicalChartData,
    { date: 'Today', OTC: Math.round(todayOTC), NASDAQ: Math.round(todayNASDAQ), NYSE: Math.round(todayNYSE) },
  ];

  const summary = {
    totalValue,
    totalCapGain,
    totalCapGainPercentage
  };

  // 6. 将所有算好的数据作为 Props 传递给客户端组件渲染
  return (
    <DashboardClient
      portfolioId={portfolio.id}
      portfolioName={portfolio.name}
      holdingsData={holdingsData}
      chartData={chartData}
      summary={summary}
    />
  );
}