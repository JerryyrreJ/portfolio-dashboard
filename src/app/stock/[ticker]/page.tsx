import { PrismaClient } from '@prisma/client'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getQuote, getCandles } from '@/lib/finnhub'

const prisma = new PrismaClient()

// 降级用的默认价格
const FALLBACK_PRICES: Record<string, number> = {
  'AMD': 200.21,
  'GOOG': 311.43,
  'EWY': 151.37,
  'XIACY': 22.06
}

interface PageProps {
  params: { ticker: string }
}

export default async function StockDetailPage({ params }: PageProps) {
  const { ticker } = params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()

  // 1. 从数据库获取资产信息和交易记录
  const asset = await prisma.asset.findUnique({
    where: { ticker: decodedTicker },
    include: {
      transactions: {
        include: {
          portfolio: true
        },
        orderBy: { date: 'asc' }
      }
    }
  })

  if (!asset) {
    notFound()
  }

  // 2. 计算持仓数据
  let totalQty = 0
  let totalCost = 0
  let totalFees = 0

  const transactions = asset.transactions.map(t => {
    const qty = t.type === 'BUY' ? t.quantity : -t.quantity
    const cost = t.type === 'BUY'
      ? (t.price * t.quantity) + t.fee
      : -(t.price * t.quantity) + t.fee

    if (t.type === 'BUY') {
      totalQty += t.quantity
      totalCost += (t.price * t.quantity) + t.fee
    } else {
      totalQty -= t.quantity
      // 卖出时按比例扣除成本
      if (totalQty + t.quantity > 0) {
        const avgCost = totalCost / (totalQty + t.quantity)
        totalCost -= avgCost * t.quantity
      } else {
        totalCost = 0
      }
    }
    totalFees += t.fee

    return {
      id: t.id,
      date: t.date.toISOString(),
      type: t.type,
      quantity: t.quantity,
      price: t.price,
      fee: t.fee,
      portfolioName: t.portfolio.name
    }
  })

  // 3. 获取实时股价
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
      lastUpdated = new Date((quote.t || Date.now()) * 1000)
    }
  } catch (error) {
    console.error('Failed to fetch quote:', error)
  }

  // 4. 获取历史价格数据用于图表
  const now = Math.floor(Date.now() / 1000)
  const oneYearAgo = now - 365 * 24 * 60 * 60
  let chartData: { date: string; price: number }[] = []

  try {
    const candles = await getCandles(decodedTicker, oneYearAgo, now, 'W')
    if (candles && candles.s === 'ok' && candles.c.length > 0) {
      chartData = candles.c.map((close: number, i: number) => ({
        date: new Date(candles.t[i] * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: close
      }))
    }
  } catch (error) {
    console.error('Failed to fetch chart data:', error)
  }

  // 5. 计算持仓统计
  const currentValue = currentPrice * totalQty
  const costBasis = totalCost
  const totalReturn = currentValue - costBasis
  const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
  const avgBuyPrice = totalQty > 0 ? costBasis / totalQty : 0

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
    transactions
  }

  return <StockDetailClient stockData={stockData} />
}
