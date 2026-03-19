import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
import { getQuote, getCompanyProfile } from '@/lib/finnhub'
import { get12MonthHistory, getLogo as getTwelveDataLogo } from '@/lib/twelvedata'

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
    // Asset not in DB — fetch live data from Finnhub for read-only view
    // Use individual try-catch to prevent one failing API from crashing the whole page
    let quote: any = null;
    let companyProfile: any = null;
    let chartData: any[] = [];
try {
  const results = await Promise.allSettled([
    getQuote(decodedTicker),
    getCompanyProfile(decodedTicker),
    get12MonthHistory(decodedTicker),
  ]);

  if (results[0].status === 'fulfilled') quote = results[0].value;
  if (results[1].status === 'fulfilled') companyProfile = results[1].value;
  if (results[2].status === 'fulfilled') chartData = results[2].value;
} catch (e) {
  console.error('Remote data fetch failed partially:', e);
}

// Only show 404 if we have absolutely NO basic info about the ticker
// Even if quote fails (403), if we have a name or it came from a valid search, we should show the page
if (!companyProfile?.name && (!quote || quote.c === 0)) {
  // One last check: maybe it's a valid ticker but our API has NO access
  // If we got this far, it means DB doesn't have it either.
  // Let's at least show a placeholder page for the ticker instead of 404
  if (!decodedTicker || decodedTicker.length > 20) notFound();
}

let defaultPortfolioId = ''
let defaultPortfolioName = ''
if (user) {
  const portfolio = await withRetry(() => prisma.portfolio.findFirst({ where: { userId: user.id } }))
  if (portfolio) {
    defaultPortfolioId = portfolio.id
    defaultPortfolioName = portfolio.name
  }
}

    const userDisplayName = user
      ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
      : ''
    const userInitial = userDisplayName ? userDisplayName[0].toUpperCase() : ''

    const stockData = {
      ticker: decodedTicker,
      name: companyProfile?.name || decodedTicker,
      market: companyProfile?.exchange || 'Unknown Market',
      currentPrice: quote?.c || 0,
      priceChange: quote?.d || 0,
      priceChangePercent: quote?.dp || 0,
      dayHigh: quote?.h || 0,
      dayLow: quote?.l || 0,
      dayOpen: quote?.o || 0,
      prevClose: quote?.pc || 0,
      lastUpdated: new Date(),
      totalQty: 0,
      currentValue: 0,
      costBasis: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      totalDividend: 0,
      avgBuyPrice: 0,
      totalFees: 0,
      chartData,
      transactions: [],
      portfolioId: defaultPortfolioId,
      portfolioName: defaultPortfolioName,
      profile: {
        name: companyProfile?.name || decodedTicker,
        ticker: decodedTicker,
        exchange: companyProfile?.exchange || '',
        logo: companyProfile?.logo || (await getTwelveDataLogo(decodedTicker)) || '',
        finnhubIndustry: companyProfile?.finnhubIndustry || '',
        country: companyProfile?.country || '',
        currency: companyProfile?.currency || 'USD',
        weburl: companyProfile?.weburl || '',
        ipo: companyProfile?.ipo || '',
        marketCapitalization: companyProfile?.marketCapitalization || 0,
      },
      metrics: null,
      userDisplayName,
      userInitial
    }

    return <StockDetailClient stockData={stockData as any} />
  }

  // 2. Compute position data (process in chronological order)
  const chronoTx = [...asset.transactions].reverse()
  let totalQty = 0
  let totalCost = 0
  let totalFees = 0
  let totalDividend = 0

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
    } else if (t.type === 'DIVIDEND') {
      totalDividend += t.price * t.quantity
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

  // 3. Read daily price history from AssetPriceHistory table
  let chartData: { date: string; price: number }[] = []
  const priceRows = await prisma.assetPriceHistory.findMany({
    where: { ticker: decodedTicker },
    orderBy: { date: 'asc' },
    select: { date: true, close: true },
  })
  chartData = priceRows.map(r => ({
    date: r.date.toISOString().split('T')[0],
    price: r.close,
  }))

  let profile: any = {
    name: asset.name,
    ticker: decodedTicker,
    exchange: asset.market,
    logo: asset.logo || (await getTwelveDataLogo(decodedTicker)) || '',
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

  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''
  const userInitial = userDisplayName ? userDisplayName[0].toUpperCase() : ''

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
    totalDividend,
    avgBuyPrice,
    totalFees,
    chartData,
    transactions,
    portfolioId: defaultPortfolioId,
    portfolioName: defaultPortfolioName,
    profile,
    metrics,
    userDisplayName,
    userInitial
  }

  return <StockDetailClient stockData={stockData as any} />
  }
