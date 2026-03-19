import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/twelvedata';
import { getCompanyProfile } from '@/lib/finnhub';

// GET /api/stock/profile?symbol=1810.HK
// Returns the asset's native currency and logo
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  const [quote, profile] = await Promise.all([
    getQuote(symbol).catch(() => null),
    getCompanyProfile(symbol).catch(() => null)
  ]);

  if (!quote?.currency && !profile?.currency) {
    return NextResponse.json({ currency: null, logo: null });
  }

  return NextResponse.json(
    { 
      currency: quote?.currency || profile?.currency || null,
      logo: profile?.logo || null
    },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
