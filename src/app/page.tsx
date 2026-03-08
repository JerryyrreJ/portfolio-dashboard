import { PrismaClient } from '@prisma/client'
import { cookies } from 'next/headers'
import DashboardClient from './DashboardClient'
import { getCompanyProfile, get12MonthHistory } from '@/lib/finnhub'

const prisma = new PrismaClient()

// 降级用的默认价格（当 API 调用失败时使用）
const FALLBACK_PRICES: Record<string, number> = {
  'AMD': 200.21,
  'GOOG': 311.43,
  'EWY': 151.37,
  'XIACY': 22.06
}

// 服务端获取实时股价（内部调用 Finnhub）
async function fetchStockQuote(symbol: string): Promise<number | null> {
  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      console.warn('FINNHUB_API_KEY not configured, using fallback price');
      return null;
    }

    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 60 } });

    if (!response.ok) {
      console.warn(`Failed to fetch quote for ${symbol}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Finnhub 返回格式: { c: 当前价格, d: 变动, dp: 变动百分比, ... }
    if (data.c && data.c > 0) {
      return data.c;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

// 批量获取股票实时价格
async function fetchBatchQuotes(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  // 顺序请求以避免 API 限流（Finnhub 免费版 60次/分钟）
  for (const symbol of symbols) {
    const price = await fetchStockQuote(symbol);
    if (price) {
      prices[symbol] = price;
    } else {
      // 使用降级价格
      prices[symbol] = FALLBACK_PRICES[symbol] || 0;
    }

    // 添加小延迟避免限流
    if (symbols.length > 5) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return prices;
}

export default async function Page() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.get('isLoggedIn')?.value === 'true';

  // 如果未登录，直接返回空状态给客户端组件，完全不查 DB
  if (!isLoggedIn) {
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

  // 1. 从数据库读取你第一个 Investment Portfolio
  const portfolio = await prisma.portfolio.findFirst({
    include: {
      transactions: {
        include: {
          asset: true
        }
      }
    }
  });

  if (!portfolio) {
    return <div className="p-8 text-center text-gray-500">No portfolio data found. Please run seed script.</div>
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
      if (current.totalQty > 0) {
         const avgCost = current.totalCost / (current.totalQty - t.quantity);
         current.totalCost += (avgCost * t.quantity); 
      } else {
         current.totalCost = 0;
      }
    }
  }

  // 3. 计算当前市值和盈亏 (使用真实 Finnhub API 数据)
  let totalValue = 0;
  let totalCostBase = 0;

  const uniqueTickers = Array.from(new Set(
    Array.from(holdingsMap.values()).map(h => h.asset.ticker)
  ));

  console.log('Fetching real-time prices for:', uniqueTickers);
  const realTimePrices = await fetchBatchQuotes(uniqueTickers);

  // 4. 智能 Logo 缓存逻辑
  const assetsWithLogo = Array.from(holdingsMap.values()).map(h => h.asset);
  const logoMap: Record<string, string | null> = {};
  
  for (const asset of assetsWithLogo) {
    let currentLogo = asset.logo;
    if (!currentLogo) {
      console.log(`Fetching and caching logo for ${asset.ticker}`);
      try {
        const profile = await getCompanyProfile(asset.ticker);
        if (profile?.logo) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { logo: profile.logo }
          });
          currentLogo = profile.logo;
        }
      } catch (err) {
        console.error(`Failed to cache logo for ${asset.ticker}:`, err);
      }
    }
    logoMap[asset.ticker] = currentLogo;
  }

  const calculatedHoldings = Array.from(holdingsMap.values()).map(h => {
    const currentPrice = realTimePrices[h.asset.ticker] ?? FALLBACK_PRICES[h.asset.ticker] ?? 0;
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
      logo: logoMap[h.asset.ticker], // 使用最新获取的 Logo
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
  for (const asset of assetsWithLogo) {
    if (!asset.priceHistory) {
      try {
        console.log(`Fetching and caching priceHistory for ${asset.ticker}`);
        const history = await get12MonthHistory(asset.ticker);
        if (history.length > 0) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { priceHistory: JSON.stringify(history), historyLastUpdated: new Date() }
          });
          asset.priceHistory = JSON.stringify(history);
        }
      } catch (err) {
        console.error(`Failed to fetch priceHistory for ${asset.ticker}:`, err);
      }
    }
  }

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