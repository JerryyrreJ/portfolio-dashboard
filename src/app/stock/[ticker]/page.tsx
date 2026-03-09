import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getQuote, getCompanyProfile, getBasicFinancials } from '@/lib/finnhub'
import { get12MonthHistory } from '@/lib/twelvedata'
import { getUser } from '@/lib/supabase-server'

import prisma from '@/lib/prisma'

// Fallback prices for when Finnhub API is unavailable
const FALLBACK_PRICES: Record<string, number> = {
  AMD: 200.21,
  GOOG: 311.43,
  EWY: 151.37,
  XIACY: 22.06,
}

interface PageProps {
  params: Promise<{ ticker: string }>
}

// Cache helper to ensure pure rendering
const getCurrentTime = () => Date.now();

export default async function StockDetailPage(props: PageProps) {
  const params = await props.params
  const { ticker } = params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()

  const user = await getUser()

  // 1. Fetch asset + only this user's transactions from DB
  const asset = await prisma.asset.findUnique({
    where: { ticker: decodedTicker },
    include: {
      transactions: {
        where: user
          ? { portfolio: { userId: user.id } }
          : { id: 'none' },
        include: { portfolio: true },
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!asset) {
    notFound()
  }

  // 2. Compute position data (process in chronological order)
  const chronoTx = [...asset.transactions].reverse()
  let totalQty = 0
  let totalCost = 0
  let totalFees = 0

  const transactions = chronoTx.map((t) => {
    if (t.type === 'BUY') {
      totalQty += t.quantity
      totalCost += t.price * t.quantity + t.fee
    } else if (t.type === 'SELL') {
      if (totalQty > 0) {
        const avgCost = totalCost / totalQty
        totalCost -= avgCost * t.quantity
      }
      totalQty -= t.quantity
    }
    totalFees += t.fee

    return {
      id: t.id,
      date: t.date.toISOString(),
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee,
      portfolioName: t.portfolio.name,
    }
  })

  // 3. 并发获取外部数据 (Quote, Profile, Metrics) 以加速渲染
  let currentPrice = 0
  let priceChange = 0
  let priceChangePercent = 0
  let dayHigh = 0
  let dayLow = 0
  let dayOpen = 0
  let prevClose = 0
  const currentTime = getCurrentTime()
  const serverTime = Math.floor(currentTime / 1000)
  let lastUpdated = new Date(serverTime * 1000)

  // Initialize profile with DB data immediately
  let profile: any = {
    name: asset.name,
    ticker: decodedTicker,
    exchange: asset.market,
    logo: asset.logo || '', 
    finnhubIndustry: 'Technology',
    country: 'US',
    currency: 'USD',
    weburl: '',
    ipo: '2000-01-01',
    marketCapitalization: 1000000
  };

  let metrics = null;

  try {
    const [quote, p, fin] = await Promise.allSettled([
      getQuote(decodedTicker),
      getCompanyProfile(decodedTicker),
      getBasicFinancials(decodedTicker)
    ]);

    if (quote.status === 'fulfilled' && quote.value && quote.value.c && quote.value.c > 0) {
      currentPrice = quote.value.c
      priceChange = quote.value.d || 0
      priceChangePercent = quote.value.dp || 0
      dayHigh = quote.value.h || 0
      dayLow = quote.value.l || 0
      dayOpen = quote.value.o || 0
      prevClose = quote.value.pc || 0
      lastUpdated = new Date((quote.value.t || serverTime) * 1000)
      
      // Update the database cache asynchronously
      prisma.asset.update({
        where: { id: asset.id },
        data: { lastPrice: currentPrice, lastPriceUpdated: new Date() }
      }).catch(err => console.error("Failed to update lastPrice cache silently:", err));
    } else {
      // Fallback to database cache or hardcoded values
      currentPrice = asset.lastPrice || FALLBACK_PRICES[decodedTicker] || 0;
      // Note: other metrics like dayHigh won't be available in fallback mode
    }

    if (p.status === 'fulfilled' && p.value && p.value.name) {
      profile = { ...profile, ...p.value };
      if (p.value.logo && p.value.logo !== asset.logo) {
        // 后台异步更新，不 await
        prisma.asset.update({
          where: { id: asset.id },
          data: { logo: p.value.logo }
        }).catch(err => console.error("Failed to update logo cache silently:", err));
      }
    }

    if (fin.status === 'fulfilled' && fin.value && fin.value.metric) {
      const metric = fin.value.metric;
      metrics = {
        week52High: metric['52WeekHigh'] || 0,
        week52Low: metric['52WeekLow'] || 0,
        peRatio: (metric.peBasicExclExtraTTM || metric.peNormalizedAnnual || 0) as number,
        eps: (metric.epsBasicExclExtraItemsTTM || metric.epsTTM || 0) as number,
        beta: (metric.beta || 0) as number,
        dividendYield: (metric.dividendYieldIndicatedAnnual || 0) as number,
      }
    }
  } catch (error) {
    console.error('Failed to fetch concurrent data:', error);
  }

  // 4. Historical price chart (12 months, persistent in DB)
  let chartData: { date: string; price: number }[] = []

  // 只要数据库里有历史数据，就直接使用，不再重新调用 API
  if (asset.priceHistory) {
    try {
      chartData = JSON.parse(asset.priceHistory)
    } catch (e) {
      console.error('Failed to parse persistent price history:', e)
    }
  }

  // 只有在数据库里完全没有数据时，才去获取一次
  if (chartData.length === 0) {
    try {
      const history = await get12MonthHistory(decodedTicker)
      if (history && history.length > 0) {
        chartData = history
        // 后台异步存入数据库，不阻塞本次渲染
        prisma.asset.update({
          where: { id: asset.id },
          data: {
            priceHistory: JSON.stringify(history),
            historyLastUpdated: new Date(currentTime)
          }
        }).catch(err => console.error("Failed to persist history silently:", err));
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  // 7. Position metrics
  const currentValue = currentPrice * totalQty
  const costBasis = totalCost
  const totalReturn = currentValue - costBasis
  const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
  const avgBuyPrice = totalQty > 0 ? costBasis / totalQty : 0

  // 8. Default portfolio for modal
  let defaultPortfolioId = ''
  let defaultPortfolioName = ''
  if (asset.transactions.length > 0) {
    defaultPortfolioId = asset.transactions[0].portfolioId
    defaultPortfolioName = asset.transactions[0].portfolio.name
  } else if (user) {
    const portfolio = await prisma.portfolio.findFirst({ where: { userId: user.id } })
    if (portfolio) {
      defaultPortfolioId = portfolio.id
      defaultPortfolioName = portfolio.name
    }
  }

  const stockData = {
    ticker: decodedTicker,
    name: asset.name,
    market: asset.market,
    currentPrice,
    priceChange,
    priceChangePercent,
    dayHigh,
    dayLow,
    dayOpen,
    prevClose,
    lastUpdated,
    totalQty,
    currentValue,
    costBasis,
    totalReturn,
    totalReturnPercent,
    avgBuyPrice,
    totalFees,
    chartData,
    transactions,
    portfolioId: defaultPortfolioId,
    portfolioName: defaultPortfolioName,
    profile,
    metrics,
  }

  return <StockDetailClient stockData={stockData} />
}
