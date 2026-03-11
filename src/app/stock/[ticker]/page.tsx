import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'

interface PageProps {
  params: Promise<{ ticker: string }>
}

export default async function StockDetailPage(props: PageProps) {
  const params = await props.params
  const { ticker } = params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()

  const user = await getUser()

  // 1. Fetch asset + only this user's transactions from DB
  const asset = await withRetry(() => prisma.asset.findUnique({
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
  }))

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

  // 3. Parse cached JSON data
  let chartData: { date: string; price: number }[] = []
  if (asset.priceHistory) {
    try {
      chartData = JSON.parse(asset.priceHistory)
    } catch (e) {
      console.error('Failed to parse persistent price history:', e)
    }
  }

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
    marketCapitalization: 0
  };

  if (asset.profile) {
    try {
      profile = { ...profile, ...JSON.parse(asset.profile) };
    } catch (e) {
      console.error('Failed to parse cached profile:', e);
    }
  }

  let metrics = null;
  if (asset.metrics) {
    try {
      metrics = JSON.parse(asset.metrics);
    } catch (e) {
      console.error('Failed to parse cached metrics:', e);
    }
  }

  // 4. Position metrics based on CACHED currentPrice
  const currentPrice = asset.lastPrice || 0
  const currentValue = currentPrice * totalQty
  const costBasis = totalCost
  const totalReturn = currentValue - costBasis
  const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
  const avgBuyPrice = totalQty > 0 ? costBasis / totalQty : 0

  // 5. Default portfolio for modal
  let defaultPortfolioId = ''
  let defaultPortfolioName = ''
  if (asset.transactions.length > 0) {
    defaultPortfolioId = asset.transactions[0].portfolioId
    defaultPortfolioName = asset.transactions[0].portfolio.name
  } else if (user) {
    const portfolio = await withRetry(() => prisma.portfolio.findFirst({ where: { userId: user.id } }))
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
    priceChange: asset.priceChange || 0,
    priceChangePercent: asset.priceChangePercent || 0,
    dayHigh: asset.dayHigh || 0,
    dayLow: asset.dayLow || 0,
    dayOpen: asset.dayOpen || 0,
    prevClose: asset.prevClose || 0,
    lastUpdated: asset.lastPriceUpdated || new Date(),
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
