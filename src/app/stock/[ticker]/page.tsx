import type { Metadata } from 'next'
import type { Asset as PrismaAsset } from '@prisma/client'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { createServerProfiler } from '@/lib/perf'
import { getUser } from '@/lib/supabase-server'
import prisma, { withRetry } from '@/lib/prisma'
import { createEmptyPersonalPosition } from '@/lib/stock-personal-data'
import type { CompanyProfile as FinnhubCompanyProfile, StockQuote } from '@/lib/finnhub'
import { getQuote, getCompanyProfile } from '@/lib/finnhub'
import { get12MonthHistory } from '@/lib/twelvedata'
import { absoluteUrl, getStockPageJsonLd, siteConfig } from '@/lib/site'

interface PageProps {
  params: Promise<{ ticker: string }>
  searchParams: Promise<{ pid?: string; pids?: string }>
}

type StockDetailData = Parameters<typeof StockDetailClient>[0]["stockData"]
type CachedProfile = StockDetailData["profile"]
type CachedMetrics = StockDetailData["metrics"]

async function buildFallbackStockData(
  decodedTicker: string,
  requestedPortfolioId: string,
  portfolioContext: { portfolioId: string; portfolioName: string },
  personalDataState: StockDetailData['personalDataState'],
  userDisplayName: string,
  quote: StockQuote | null,
  companyProfile: FinnhubCompanyProfile | null,
  chartData: StockDetailData["chartData"]
): Promise<StockDetailData> {
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
    chartData,
    requestedPortfolioId,
    profile: {
      name: companyProfile?.name || decodedTicker,
      exchange: companyProfile?.exchange || '',
      logo: companyProfile?.logo || '',
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
    ...createEmptyPersonalPosition(personalDataState, portfolioContext),
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
  const pids = searchParams.pids
  const perf = createServerProfiler('stock/page', `ticker=${decodedTicker}${pids ? ` pids=${pids}` : pid ? ` pid=${pid}` : ''}`)

  const user = await perf.time('getUser', () => getUser())
  const userDisplayName = user
    ? (user.user_metadata?.display_name || user.email?.split('@')[0] || '')
    : ''
  const personalDataState: StockDetailData['personalDataState'] = user ? 'loading' : 'guest'

  // 1. Fetch public asset data only. Personal position data is loaded separately.
  let asset: PrismaAsset | null = null
  try {
    asset = await perf.time('asset.findUniquePublic', () => prisma.asset.findUnique({
      where: { ticker: decodedTicker },
    }))
  } catch (error) {
    console.warn(`Failed to load cached asset for ${decodedTicker}:`, error)
  }

  if (!asset) {
    // Asset not in DB — fetch live data from Finnhub for read-only view
    // Use individual try-catch to prevent one failing API from crashing the whole page
    let quote: StockQuote | null = null
    let companyProfile: FinnhubCompanyProfile | null = null
    let chartData: StockDetailData["chartData"] = []

    try {
      const results = await perf.time('fallback.remoteFetch', () => Promise.allSettled([
        getQuote(decodedTicker),
        getCompanyProfile(decodedTicker),
        get12MonthHistory(decodedTicker),
      ]))

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

    const stockData = await buildFallbackStockData(
      decodedTicker,
      pid ?? '',
      { portfolioId: '', portfolioName: '' },
      user ? 'empty' : 'guest',
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

    perf.flush(`fallback user=${user?.id ?? 'guest'} tx=0 chart=${stockData.chartData.length}`)
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

  // 2. Read daily price history from AssetPriceHistory table
  let chartData: { date: string; price: number }[] = []
  try {
    const priceRows = await perf.time('assetPriceHistory.findMany', () => prisma.assetPriceHistory.findMany({
      where: { ticker: decodedTicker },
      orderBy: { date: 'asc' },
      select: { date: true, close: true },
    }))
    chartData = priceRows.map(r => ({
      date: r.date.toISOString().split('T')[0],
      price: r.close,
    }))
  } catch (error) {
    console.warn(`Failed to load cached chart data for ${decodedTicker}:`, error)
    const remoteHistory = await perf.time('chart.remoteFallback', () => get12MonthHistory(decodedTicker))
    chartData = remoteHistory
  }

  const profile = parseCachedProfile(asset, asset.logo || '')
  const metrics = parseCachedMetrics(asset.metrics)

  // 3. Public market metrics based on cached current price
  const currentPrice = asset.lastPrice || 0
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
    chartData,
    requestedPortfolioId: pid ?? '',
    requestedPortfolioIds: pids ?? (pid ?? ''),
    profile,
    metrics,
    userDisplayName,
    userInitial,
    ...createEmptyPersonalPosition(personalDataState),
  }

  const description = `Track ${stockData.name} price, holdings, transactions, and dividend performance with ${siteConfig.name}.`
  const stockJsonLd = getStockPageJsonLd({
    ticker: decodedTicker,
    name: stockData.name,
    description,
    exchange: stockData.profile?.exchange || stockData.market,
    issuerUrl: stockData.profile?.weburl || null,
  })

  perf.flush(`user=${user?.id ?? 'guest'} chart=${chartData.length} personal=${personalDataState}`)
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
