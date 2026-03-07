import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getQuote, getCandles, getCompanyProfile, getBasicFinancials } from '@/lib/finnhub'

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

export default async function StockDetailPage(props: PageProps) {
  const params = await props.params
  const { ticker } = params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()

  // 1. Fetch asset + transactions from DB
  const asset = await prisma.asset.findUnique({
    where: { ticker: decodedTicker },
    include: {
      transactions: {
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

  // 3. Real-time stock quote
  let currentPrice = FALLBACK_PRICES[decodedTicker] || 0
  let priceChange = 0
  let priceChangePercent = 0
  let dayHigh = 0
  let dayLow = 0
  let dayOpen = 0
  let prevClose = 0
  let lastUpdated = new Date()

  try {
    const quote = await getQuote(decodedTicker)
    if (quote && quote.c > 0) {
      currentPrice = quote.c
      priceChange = quote.d || 0
      priceChangePercent = quote.dp || 0
      dayHigh = quote.h || 0
      dayLow = quote.l || 0
      dayOpen = quote.o || 0
      prevClose = quote.pc || 0
      lastUpdated = new Date((quote.t || Math.floor(Date.now() / 1000)) * 1000)
    }
  } catch (error) {
    console.error('Failed to fetch quote:', error)
  }

  // 4. Historical price chart (1 year, weekly)
  const now = Math.floor(Date.now() / 1000)
  const oneYearAgo = now - 365 * 24 * 60 * 60
  let chartData: { date: string; price: number }[] = []

  try {
    const candles = await getCandles(decodedTicker, oneYearAgo, now, 'W')
    if (candles && candles.s === 'ok' && candles.c.length > 0) {
      chartData = candles.c.map((close: number, i: number) => ({
        date: new Date(candles.t[i] * 1000).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        price: close,
      }))
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error)
  }

  // 5. Company profile
  let profile = null
  try {
    const p = await getCompanyProfile(decodedTicker)
    if (p && p.name) profile = p
  } catch (error) {
    console.error('Failed to fetch company profile:', error)
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
  } else {
    const portfolio = await prisma.portfolio.findFirst()
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
