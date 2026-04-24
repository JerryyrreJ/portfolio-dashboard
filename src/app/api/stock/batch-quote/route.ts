import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';
const MAX_SYMBOLS_PER_REQUEST = 50;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get('symbols');

  if (!symbolsParam) {
    return NextResponse.json({ error: 'Symbols parameter is required (comma-separated)' }, { status: 400 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'Finnhub API key not configured' }, { status: 500 });
  }

  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({});
  }

  if (symbols.length > MAX_SYMBOLS_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many symbols (max ${MAX_SYMBOLS_PER_REQUEST})` },
      { status: 400 }
    );
  }

  const prices: Record<string, number> = {};

  try {
    // 并发请求所有提供的股票代码
      let hasRateLimit = false;

      const fetchPromises = symbols.map(async (symbol) => {
        const url = `${BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒短超时

        try {
          const response = await fetch(url, {
            next: { revalidate: 60 },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.status === 429) {
            hasRateLimit = true;
          }

          if (response.ok) {
            const data = await response.json();
            if (data && data.c && data.c > 0) {
              prices[symbol] = data.c;
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.warn(`Failed to fetch real-time quote for ${symbol}:`, error);
        }
      });

      await Promise.allSettled(fetchPromises);

      const nextResponse = NextResponse.json(prices);
      if (hasRateLimit) {
        nextResponse.headers.set('X-RateLimit-Exhausted', 'true');
      }
      return nextResponse;
  } catch (error) {
    console.error('Batch quote error:', error);
    return NextResponse.json({ error: 'Failed to fetch batch quotes' }, { status: 500 });
  }
}
