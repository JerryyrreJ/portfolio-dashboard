import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getQuote, getCandles, getCompanyProfile, getBasicFinancials, get12MonthHistory } from '@/lib/finnhub'
import { getUser } from '@/lib/supabase-server'

const prisma = new PrismaClient()

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

  // 3. Current price & Market data
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

  try {
    const quote = await getQuote(decodedTicker)
    if (quote) {
      currentPrice = quote.c || 0
      priceChange = quote.d || 0
      priceChangePercent = quote.dp || 0
      dayHigh = quote.h || 0
      dayLow = quote.l || 0
      dayOpen = quote.o || 0
      prevClose = quote.pc || 0
      lastUpdated = new Date((quote.t || serverTime) * 1000)
    }
  } catch (error) {
    console.error('Failed to fetch quote:', error)
  }

  // 4. Historical price chart (12 months, persistent in DB)
  let chartData: { date: string; price: number }[] = []

  // 只要数据库里有历史数据，就直接使用，不再重新调用 API
  if (asset.priceHistory) {
    try {
      chartData = JSON.parse(asset.priceHistory)
      console.log(`Using persistent history cache for ${decodedTicker}`);
    } catch (e) {
      console.error('Failed to parse persistent price history:', e)
    }
  }

  // 只有在数据库里完全没有数据时，才去获取一次
  if (chartData.length === 0) {
    try {
      console.log(`No history found in DB. Fetching once for ${decodedTicker}`);
      const history = await get12MonthHistory(decodedTicker)
      if (history.length > 0) {
        chartData = history
        // 将历史数据存入数据库，此后将永远从数据库读取
        await prisma.asset.update({
          where: { id: asset.id },
          data: {
            priceHistory: JSON.stringify(history),
            historyLastUpdated: new Date(currentTime)
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch and persist history:', error)
    }
  }

  // Final fallback: If data is still missing, keep it empty to inform user
  if (chartData.length === 0) {
    console.warn(`No real historical data could be retrieved for ${decodedTicker}`);
    // Keep chartData as [] to show empty state instead of fake data
  }

  // 5. Company profile & Logo Caching
  // Initialize profile with DB data immediately to prevent flickering
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

  try {
    const p = await getCompanyProfile(decodedTicker)
    if (p && p.name) {
      // Merge Finnhub data into our profile, but keep our logo if it's already there
      profile = { ...profile, ...p };
      
      // Update logo cache if it's missing or different
      if (p.logo && p.logo !== asset.logo) {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { logo: p.logo }
        }).catch(err => console.error("Failed to update logo cache:", err));
      }
    }
  } catch (error) {
    console.error('Failed to fetch company profile from Finnhub:', error)
    // Profile is already initialized with DB/Fallback data, so we're safe
  }

  // 6. Key financial metrics
  let metrics = null
  try {
    const fin = await getBasicFinancials(decodedTicker)
    if (fin && fin.metric) {
      metrics = {
        week52High: fin.metric['52WeekHigh'] || 0,
        week52Low: fin.metric['52WeekLow'] || 0,
        peRatio: (fin.metric.peBasicExclExtraTTM || fin.metric.peNormalizedAnnual || 0) as number,
        eps: (fin.metric.epsBasicExclExtraItemsTTM || fin.metric.epsTTM || 0) as number,
        beta: (fin.metric.beta || 0) as number,
        dividendYield: (fin.metric.dividendYieldIndicatedAnnual || 0) as number,
      }
    }
  } catch (error) {
    console.error('Failed to fetch metrics:', error)
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
