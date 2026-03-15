import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/twelvedata';

// GET /api/stock/profile?symbol=1810.HK
// Returns the asset's native currency via Twelve Data quote
export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  const quote = await getQuote(symbol);
  if (!quote?.currency) {
    return NextResponse.json({ currency: null });
  }

  return NextResponse.json(
    { currency: quote.currency },
    { headers: { 'Cache-Control': 'public, max-age=86400' } }
  );
}
