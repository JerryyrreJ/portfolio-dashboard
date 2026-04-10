import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getCompanyProfile, getBasicFinancials, isFinnhubRateLimited, resetFinnhubRateLimit } from '@/lib/finnhub';
import { isTwelveDataRateLimited, resetTwelveDataRateLimit } from '@/lib/twelvedata';
import { getQuote as getTDQuote, get12MonthHistory } from '@/lib/twelvedata';
import { getQuote as getFinnhubQuote } from '@/lib/finnhub';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const decodedTicker = decodeURIComponent(ticker).toUpperCase();
    const forceMode = request.nextUrl.searchParams.get('force');
    const forceProfileSync = forceMode === '1' || forceMode === 'true' || forceMode === 'profile';

    // Reset rate limit trackers for this request
    resetFinnhubRateLimit();
    resetTwelveDataRateLimit();

    const asset = await prisma.asset.findUnique({
      where: { ticker: decodedTicker }
    });

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const needsQuoteSync = !asset.lastPriceUpdated || asset.lastPriceUpdated < oneHourAgo;
    const needsHistorySync = !asset.historyLastUpdated || asset.historyLastUpdated < twentyFourHoursAgo;
    const needsProfileSync = forceProfileSync || !asset.profile || !asset.logo;

    const updateData: Prisma.AssetUpdateInput = {};
    const currentTime = new Date();

    // 1. Quote: Twelve Data first, Finnhub as fallback
    if (needsQuoteSync) {
      const tdQuote = await getTDQuote(decodedTicker);
      if (tdQuote && tdQuote.price > 0) {
        updateData.lastPrice = tdQuote.price;
        updateData.priceChange = tdQuote.change;
        updateData.priceChangePercent = tdQuote.changePercent;
        updateData.dayHigh = tdQuote.high;
        updateData.dayLow = tdQuote.low;
        updateData.dayOpen = tdQuote.open;
        updateData.prevClose = tdQuote.prevClose;
        updateData.lastPriceUpdated = currentTime;
      } else {
        // Fallback to Finnhub
        const fq = await getFinnhubQuote(decodedTicker);
        if (fq && fq.c > 0) {
          updateData.lastPrice = fq.c;
          updateData.priceChange = fq.d;
          updateData.priceChangePercent = fq.dp;
          updateData.dayHigh = fq.h;
          updateData.dayLow = fq.l;
          updateData.dayOpen = fq.o;
          updateData.prevClose = fq.pc;
          updateData.lastPriceUpdated = currentTime;
        } else {
          // Last resort: use latest row from AssetPriceHistory
          const latest = await prisma.assetPriceHistory.findFirst({
            where: { ticker: decodedTicker },
            orderBy: { date: 'desc' },
            select: { close: true },
          });
          if (latest) {
            updateData.lastPrice = latest.close;
            updateData.lastPriceUpdated = currentTime;
          }
        }
      }
    }

    // 2. Profile/logo (Finnhub only)
    if (needsProfileSync) {
      const p = await getCompanyProfile(decodedTicker);
      if (p?.name) {
        updateData.profile = JSON.stringify({
          finnhubIndustry: p.finnhubIndustry,
          country: p.country,
          currency: p.currency,
          weburl: p.weburl,
          ipo: p.ipo,
          marketCapitalization: p.marketCapitalization,
          name: p.name,
          exchange: p.exchange,
        });

        if (typeof p.logo === 'string' && p.logo.trim()) {
          updateData.logo = p.logo.trim();
        }
      }
    }

    // 3. Financials (Finnhub only)
    if (needsQuoteSync || needsProfileSync) {
      const fr = await getBasicFinancials(decodedTicker);
      if (fr?.metric) {
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

    // 4. History (Twelve Data) - bulk upsert
    let historyUpserted = 0;
    if (needsHistorySync) {
      const hv = await get12MonthHistory(decodedTicker);
      if (hv.length > 0) {
        const values = hv.map(p => `('${decodedTicker}', '${p.date}'::date, ${p.price})`).join(',');
        await prisma.$executeRawUnsafe(`
          INSERT INTO "AssetPriceHistory" (ticker, date, close)
          VALUES ${values}
          ON CONFLICT (ticker, date) DO UPDATE SET close = EXCLUDED.close
        `);
        updateData.historyLastUpdated = currentTime;
        historyUpserted = hv.length;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new data to update',
        ticker: decodedTicker,
      });
    }

    await prisma.asset.update({
      where: { ticker: decodedTicker },
      data: updateData,
    });

    const nextResponse = NextResponse.json({
      success: true,
      ticker: decodedTicker,
      updatedAt: currentTime.toISOString(),
      historyUpserted,
    });

    if (isFinnhubRateLimited() || isTwelveDataRateLimited()) {
      nextResponse.headers.set('X-RateLimit-Exhausted', 'true');
    }

    return nextResponse;

  } catch (error) {
    console.error('Failed to sync asset data:', error);
    return NextResponse.json({ error: 'Failed to sync asset data' }, { status: 500 });
  }
}
