import { PrismaClient } from '@prisma/client'
import DashboardClient from './DashboardClient'

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
        totalCost: 0, // 包含了买入价格 * 数量 + 手续费
      })
    }
    const current = holdingsMap.get(ticker);
    
    // 处理买入和卖出计算
    if (t.type === 'BUY') {
      current.totalQty += t.quantity;
      current.totalCost += (t.price * t.quantity) + t.fee;
    } else if (t.type === 'SELL') {
      current.totalQty += t.quantity; // 卖出时客户端传来的 quantity 是负数
      // 简单处理：卖出时按比例扣除成本 (Cost Basis)
      if (current.totalQty > 0) {
         // 粗略估算平均成本
         const avgCost = current.totalCost / (current.totalQty - t.quantity);
         current.totalCost += (avgCost * t.quantity); // t.quantity 是负数，所以总成本减少
      } else {
         current.totalCost = 0;
      }
    }
  }

  // 3. 计算当前市值和盈亏 (使用真实 Finnhub API 数据)
  let totalValue = 0;
  let totalCostBase = 0;

  // 获取所有持仓股票的实时价格
  const uniqueTickers = Array.from(new Set(
    Array.from(holdingsMap.values()).map(h => h.asset.ticker)
  ));

  console.log('Fetching real-time prices for:', uniqueTickers);
  const realTimePrices = await fetchBatchQuotes(uniqueTickers);
  console.log('Received prices:', realTimePrices);

  const calculatedHoldings = Array.from(holdingsMap.values()).map(h => {
    // 优先使用 Finnhub 实时价格，否则使用降级价格
    const currentPrice = realTimePrices[h.asset.ticker] ?? FALLBACK_PRICES[h.asset.ticker] ?? 0;
    const value = currentPrice * h.totalQty;
    const capGain = value - h.totalCost;
    const returnPct = h.totalCost > 0 ? (capGain / h.totalCost) * 100 : 0;

    totalValue += value;
    totalCostBase += h.totalCost;

    return {
      ticker: `${h.asset.ticker} | ${h.asset.market}`,
      name: h.asset.name,
      market: h.asset.market,
      price: currentPrice,
      qty: h.totalQty,
      value: value,
      capGain: capGain,
      return: returnPct,
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
  // 使用实时计算的数据作为 "Today" 点的值
  const todayOTC = calculatedHoldings.filter(h=>h.market==='OTC').reduce((s,h)=>s+h.value,0);
  const todayNASDAQ = calculatedHoldings.filter(h=>h.market==='NASDAQ').reduce((s,h)=>s+h.value,0);
  const todayNYSE = calculatedHoldings.filter(h=>h.market==='NYSE').reduce((s,h)=>s+h.value,0);

  const chartData = [
    { date: '18 Oct 25', OTC: 0, NASDAQ: 0, NYSE: 0 },
    { date: '15 Nov 25', OTC: 0, NASDAQ: 110, NYSE: 0 },
    { date: '13 Dec 25', OTC: 0, NASDAQ: 105, NYSE: 0 },
    { date: '10 Jan 26', OTC: 0, NASDAQ: 100, NYSE: 0 },
    { date: '07 Feb 26', OTC: 0, NASDAQ: 95, NYSE: 0 },
    { date: '15 Feb 26', OTC: 20, NASDAQ: 150, NYSE: 50 },
    { date: '25 Feb 26', OTC: 80, NASDAQ: 350, NYSE: 120 },
    { date: 'Today', OTC: todayOTC, NASDAQ: todayNASDAQ, NYSE: todayNYSE },
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