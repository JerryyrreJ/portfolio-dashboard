import { NextRequest, NextResponse } from 'next/server';
import { getCompanyNews } from '@/lib/finnhub';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  // Default: past 14 days
  const toDate = to || new Date().toISOString().split('T')[0];
  const fromDate = from || new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  try {
    const news = await getCompanyNews(symbol, fromDate, toDate);
    return NextResponse.json(news, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('News fetch error:', error);
    return NextResponse.json([], { status: 200 }); // Return empty array on error
  }
}
