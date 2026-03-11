import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getQuote, getCompanyProfile, getBasicFinancials } from '@/lib/finnhub';
import { get12MonthHistory } from '@/lib/twelvedata';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const decodedTicker = decodeURIComponent(ticker).toUpperCase();

    // 1. Fetch Asset from DB to confirm it exists
    const asset = await prisma.asset.findUnique({
      where: { ticker: decodedTicker }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // 2. Determine what needs syncing
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const needsQuoteSync = !asset.lastPriceUpdated || asset.lastPriceUpdated < oneHourAgo;
    const needsHistorySync = !asset.historyLastUpdated || asset.historyLastUpdated < twentyFourHoursAgo;
    const needsProfileSync = !asset.profile; // Only fetch profile if missing

    const apiCalls = [];
    
    // Add Quote, Profile, Financials to sync if needed (Finnhub)
    if (needsQuoteSync) apiCalls.push(getQuote(decodedTicker));
    else apiCalls.push(Promise.resolve(null));

    if (needsProfileSync) apiCalls.push(getCompanyProfile(decodedTicker));
    else apiCalls.push(Promise.resolve(null));

    if (needsQuoteSync || needsProfileSync) apiCalls.push(getBasicFinancials(decodedTicker));
    else apiCalls.push(Promise.resolve(null));

    // Add History to sync ONLY if it's older than 24 hours (Twelve Data)
    if (needsHistorySync) apiCalls.push(get12MonthHistory(decodedTicker));
    else apiCalls.push(Promise.resolve(null));

    const [quoteResult, profileResult, financialsResult, historyResult] = await Promise.allSettled(apiCalls);

    const updateData: any = {};
    const currentTime = new Date();

    // Parse Quote (Finnhub) - ONLY IF VALID
    // Check if current price is a positive number
    if (quoteResult.status === 'fulfilled' && quoteResult.value) {
      const q = quoteResult.value as any;
      if (q.c > 0) {
        updateData.lastPrice = q.c;
        updateData.priceChange = q.d;
        updateData.priceChangePercent = q.dp;
        updateData.dayHigh = q.h;
        updateData.dayLow = q.l;
        updateData.dayOpen = q.o;
        updateData.prevClose = q.pc;
        updateData.lastPriceUpdated = currentTime;
      } else if (!q.c) {
        console.warn(`Finnhub quote returned null/zero for ${decodedTicker}, preserving old price.`);
      }
    }

    // Parse Profile (Finnhub) - ONLY IF VALID
    if (profileResult.status === 'fulfilled' && profileResult.value) {
      const p = profileResult.value as any;
      if (p.name) {
        updateData.logo = p.logo || asset.logo;
        updateData.profile = JSON.stringify({
          finnhubIndustry: p.finnhubIndustry,
          country: p.country,
          currency: p.currency,
          weburl: p.weburl,
          ipo: p.ipo,
          marketCapitalization: p.marketCapitalization,
          name: p.name,
          exchange: p.exchange
        });
      }
    }

    // Parse Financials (Finnhub) - ONLY IF VALID
    if (financialsResult.status === 'fulfilled' && financialsResult.value) {
      const fr = financialsResult.value as any;
      if (fr.metric) {
        const m = fr.metric;
        updateData.metrics = JSON.stringify({
          week52High: m['52WeekHigh'] || 0,
          week52Low: m['52WeekLow'] || 0,
          peRatio: m.peBasicExclExtraTTM || m.peNormalizedAnnual || 0,
          eps: m.epsBasicExclExtraItemsTTM || m.epsTTM || 0,
          beta: m.beta || 0,
          dividendYield: m.dividendYieldIndicatedAnnual || 0,
        });
      }
    }

    // Parse History (Twelve Data) - ONLY IF FETCHED AND VALID
    // Defensive check: only update if we got a non-empty array
    if (historyResult.status === 'fulfilled' && historyResult.value) {
      const hv = historyResult.value as any;
      if (Array.isArray(hv) && hv.length > 0) {
        updateData.priceHistory = JSON.stringify(hv);
        updateData.historyLastUpdated = currentTime;
      } else if (!hv || hv.length === 0) {
        console.warn(`History sync returned empty for ${decodedTicker}`);
      }
    } else if (historyResult.status === 'fulfilled' && (!historyResult.value || (historyResult.value as any).length === 0)) {
      // If we got an empty result or error from API, we DO NOT update priceHistory
      // This preserves the old valid data in the database
      console.warn(`Twelve Data returned empty/error for ${decodedTicker}, preserving old cache.`);
    }

    // 3. Update DB - only if there's something to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new data to update, preserved existing cache',
        ticker: decodedTicker
      });
    }

    return NextResponse.json({
      success: true,
      ticker: decodedTicker,
      updatedAt: currentTime.toISOString()
    });

  } catch (error) {
    console.error('Failed to sync asset data:', error);
    return NextResponse.json(
      { error: 'Failed to sync asset data' },
      { status: 500 }
    );
  }
}
