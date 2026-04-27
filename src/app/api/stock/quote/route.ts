import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

export async function GET(request: NextRequest) {
  const rateLimit = await applyRateLimit(request, {
    keyPrefix: 'api:stock:quote',
    limit: 120,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: rateLimit.headers }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json(
      { error: 'Symbol parameter is required' },
      { status: 400 }
    );
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: 'Finnhub API key not configured' },
      { status: 500 }
    );
  }

  try {
    const url = `${BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url, {
      next: { revalidate: 60 }, // 缓存 60 秒
    });

    if (!response.ok) {
      // 非美股在免费套餐下会返回 403，静默处理，前端价格留空让用户手动填
      console.warn(`Finnhub quote unavailable for ${symbol}: ${response.status}`);
      
      const nextResponse = NextResponse.json({ c: 0 }, { headers: rateLimit.headers });
      if (response.status === 429) {
        nextResponse.headers.set('X-RateLimit-Exhausted', 'true');
      }
      return nextResponse;
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: rateLimit.headers });
  } catch (error) {
    console.error('Stock quote error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock quote' },
      { status: 500, headers: rateLimit.headers }
    );
  }
}
