import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCompanyProfile, getBasicFinancials } from '@/lib/finnhub';
import { getQuote as getTDQuote, get12MonthHistory } from '@/lib/twelvedata';
import { getQuote as getFinnhubQuote } from '@/lib/finnhub';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const decodedTicker = decodeURIComponent(ticker).toUpperCase();

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
    const needsProfileSync = !asset.profile;

    const updateData: any = {};
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
        const fq = await getFinnhubQuote(decodedTicker) as any;
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

    // 2. Profile (Finnhub only)
    if (needsProfileSync) {
      const p = await getCompanyProfile(decodedTicker) as any;
      if (p?.name) {
        updateData.logo = p.logo || asset.logo;
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
      }
    }

    // 3. Financials (Finnhub only)
    if (needsQuoteSync || needsProfileSync) {
      const fr = await getBasicFinancials(decodedTicker) as any;
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

    return NextResponse.json({
      success: true,
      ticker: decodedTicker,
      updatedAt: currentTime.toISOString(),
      historyUpserted,
    });

  } catch (error) {
    console.error('Failed to sync asset data:', error);
    return NextResponse.json({ error: 'Failed to sync asset data' }, { status: 500 });
  }
}
