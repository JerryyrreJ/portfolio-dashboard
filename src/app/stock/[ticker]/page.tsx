import type { Metadata } from 'next'
import type { Asset as PrismaAsset, Portfolio, Transaction } from '@prisma/client'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
import type { CompanyProfile as FinnhubCompanyProfile, StockQuote } from '@/lib/finnhub'
import { getQuote, getCompanyProfile } from '@/lib/finnhub'
import { get12MonthHistory, getLogo as getTwelveDataLogo } from '@/lib/twelvedata'
import { absoluteUrl, getStockPageJsonLd, siteConfig } from '@/lib/site'

interface PageProps {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ pid?: string }>
}

type StockDetailData = Parameters<typeof StockDetailClient>[0]["stockData"]
type StockTransaction = Transaction & { portfolio: Portfolio }
type CachedProfile = StockDetailData["profile"]
type CachedMetrics = StockDetailData["metrics"]
type PositionSummary = {
  totalQty: number
  totalCost: number
  totalFees: number
  totalDividend: number
  transactions: StockDetailData["transactions"]
}

function buildPositionSummary(transactions: StockTransaction[]): PositionSummary {
  return transactions.reduce<PositionSummary>(
    (summary, transaction) => {
      let nextQty = summary.totalQty
      let nextCost = summary.totalCost
      let nextDividend = summary.totalDividend

      if (transaction.type === 'BUY') {
        nextQty += transaction.quantity
        nextCost += transaction.price * transaction.quantity + transaction.fee
      } else if (transaction.type === 'SELL') {
        if (nextQty > 0) {
          const avgCost = nextCost / nextQty
          nextCost -= avgCost * transaction.quantity
        }
        nextQty -= transaction.quantity
      } else if (transaction.type === 'DIVIDEND') {
        nextDividend += transaction.price * transaction.quantity
      }

      return {
        totalQty: nextQty,
        totalCost: nextCost,
        totalFees: summary.totalFees + transaction.fee,
        totalDividend: nextDividend,
        transactions: [
          ...summary.transactions,
          {
            id: transaction.id,
            date: transaction.date.toISOString(),
            type: transaction.type,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee,
            portfolioName: transaction.portfolio.name,
          },
        ],
      }
    },
    {
      totalQty: 0,
      totalCost: 0,
      totalFees: 0,
      totalDividend: 0,
      transactions: [],
    }
  )
}

async function buildFallbackStockData(
  decodedTicker: string,
  pid: string | undefined,
  userId: string | undefined,
  userDisplayName: string,
  quote: StockQuote | null,
  companyProfile: FinnhubCompanyProfile | null,
  chartData: StockDetailData["chartData"]
): Promise<StockDetailData> {
  let defaultPortfolioId = ''
  let defaultPortfolioName = ''

  if (userId) {
    const portfolio = pid
      ? await withRetry(() => prisma.portfolio.findFirst({ where: { id: pid, userId } }))
      : await withRetry(() => prisma.portfolio.findFirst({ where: { userId } }))
    if (portfolio) {
      defaultPortfolioId = portfolio.id
      defaultPortfolioName = portfolio.name
    }
  }

  return {
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
    userInitial: userDisplayName ? userDisplayName[0].toUpperCase() : '',
  }
}

function parseCachedProfile(
  asset: PrismaAsset,
  logo: string
): CachedProfile {
  const fallbackProfile: NonNullable<CachedProfile> = {
    name: asset.name,
    exchange: asset.market,
    logo,
    finnhubIndustry: 'Technology',
    country: 'US',
    currency: 'USD',
    weburl: '',
    ipo: '2000-01-01',
    marketCapitalization: 0,
  }

  if (!asset.profile) return fallbackProfile

  try {
    return { ...fallbackProfile, ...(JSON.parse(asset.profile) as Partial<NonNullable<CachedProfile>>) }
  } catch (error) {
    console.error('Failed to parse cached profile:', error)
    return fallbackProfile
  }
}

function parseCachedMetrics(metrics: string | null): CachedMetrics {
  if (!metrics) return null

  try {
    return JSON.parse(metrics) as CachedMetrics
  } catch (error) {
    console.error('Failed to parse cached metrics:', error)
    return null
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { ticker } = await props.params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()

  let assetName = decodedTicker

  try {
    const asset = await withRetry(() =>
      prisma.asset.findUnique({
        where: { ticker: decodedTicker },
        select: { name: true },
      })
    )
    if (asset?.name) assetName = asset.name
  } catch (error) {
    console.error(`Failed to resolve metadata for ${decodedTicker}:`, error)
  }

  const title =
    assetName === decodedTicker
      ? `${decodedTicker} Stock Overview`
      : `${assetName} (${decodedTicker}) Stock Overview`
  const description = `Track ${assetName} price, holdings, transactions, and dividend performance with ${siteConfig.name}.`
  const canonicalPath = `/stock/${encodeURIComponent(decodedTicker)}`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: canonicalPath,
      type: "website",
      images: [
        {
          url: absoluteUrl("/icon"),
          width: 512,
          height: 512,
          alt: `${siteConfig.name} icon`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [absoluteUrl("/icon")],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function StockDetailPage(props: PageProps) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams])
  const { ticker } = params
  const decodedTicker = decodeURIComponent(ticker).toUpperCase()
  const pid = searchParams.pid

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
    let quote: StockQuote | null = null
    let companyProfile: FinnhubCompanyProfile | null = null
    let chartData: StockDetailData["chartData"] = []

    try {
      const results = await Promise.allSettled([
        getQuote(decodedTicker),
        getCompanyProfile(decodedTicker),
        get12MonthHistory(decodedTicker),
      ])

      if (results[0].status === 'fulfilled') quote = results[0].value
      if (results[1].status === 'fulfilled') companyProfile = results[1].value
      if (results[2].status === 'fulfilled') chartData = results[2].value
    } catch (error) {
      console.error('Remote data fetch failed partially:', error)
    }

    // Only show 404 if we have absolutely NO basic info about the ticker
    // Even if quote fails (403), if we have a name or it came from a valid search, we should show the page
    if (!companyProfile?.name && (!quote || quote.c === 0)) {
      // One last check: maybe it's a valid ticker but our API has NO access
      // If we got this far, it means DB doesn't have it either.
      // Let's at least show a placeholder page for the ticker instead of 404
      if (!decodedTicker || decodedTicker.length > 20) notFound()
    }

    const userDisplayName = user
      ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
      : ''

    const stockData = await buildFallbackStockData(
      decodedTicker,
      pid,
      user?.id,
      userDisplayName,
      quote,
      companyProfile,
      chartData
    )

    const description = `Track ${stockData.name} price, holdings, transactions, and dividend performance with ${siteConfig.name}.`
    const stockJsonLd = getStockPageJsonLd({
      ticker: decodedTicker,
      name: stockData.name,
      description,
      exchange: stockData.profile?.exchange || stockData.market,
      issuerUrl: stockData.profile?.weburl || null,
    })

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(stockJsonLd) }}
        />
        <StockDetailClient stockData={stockData} />
      </>
    )
  }

  // 2. Compute position data (process in chronological order)
  const chronoTx = [...asset.transactions].reverse()
  const positionSummary = buildPositionSummary(chronoTx)
  const { totalQty, totalCost, totalFees, totalDividend, transactions } = positionSummary

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

  const profile = parseCachedProfile(
    asset,
    asset.logo || (await getTwelveDataLogo(decodedTicker)) || ''
  )
  const metrics = parseCachedMetrics(asset.metrics)

  // 4. Position metrics based on CACHED currentPrice
  const currentPrice = asset.lastPrice || 0
  const currentValue = currentPrice * totalQty
  const costBasis = totalCost
  // totalReturn 包含资本利得 + 股息，与 dashboard 层保持一致
  const capitalGain = currentValue - costBasis
  const totalReturn = capitalGain + totalDividend
  const totalReturnPercent = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0
  const avgBuyPrice = totalQty > 0 ? costBasis / totalQty : 0

  // 5. Default portfolio for modal
  let defaultPortfolioId = ''
  let defaultPortfolioName = ''
  if (asset.transactions.length > 0) {
    defaultPortfolioId = asset.transactions[0].portfolioId
    defaultPortfolioName = asset.transactions[0].portfolio.name
  } else if (user) {
    const portfolio = pid
      ? await withRetry(() => prisma.portfolio.findFirst({ where: { id: pid, userId: user.id } }))
      : await withRetry(() => prisma.portfolio.findFirst({ where: { userId: user.id } }))
    if (portfolio) {
      defaultPortfolioId = portfolio.id
      defaultPortfolioName = portfolio.name
    }
  }

  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''
  const userInitial = userDisplayName ? userDisplayName[0].toUpperCase() : ''

  const stockData: StockDetailData = {
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

  const description = `Track ${stockData.name} price, holdings, transactions, and dividend performance with ${siteConfig.name}.`
  const stockJsonLd = getStockPageJsonLd({
    ticker: decodedTicker,
    name: stockData.name,
    description,
    exchange: stockData.profile?.exchange || stockData.market,
    issuerUrl: stockData.profile?.weburl || null,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(stockJsonLd) }}
      />
      <StockDetailClient stockData={stockData} />
    </>
  )
  }
