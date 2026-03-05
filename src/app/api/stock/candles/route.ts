import { NextResponse } from 'next/server';
import { getCandles } from '@/lib/finnhub';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1Y';

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ticker symbol is required' },
      { status: 400 }
    );
  }

  try {
    // Calculate from and to dates based on range
    const to = new Date();
    const from = new Date();

    switch (range) {
      case '1M':
        from.setMonth(to.getMonth() - 1);
        break;
      case '3M':
        from.setMonth(to.getMonth() - 3);
        break;
      case '6M':
        from.setMonth(to.getMonth() - 6);
        break;
      case '1Y':
        from.setFullYear(to.getFullYear() - 1);
        break;
      default:
        from.setFullYear(to.getFullYear() - 1);
    }

    const candles = await getCandles(ticker, Math.floor(from.getTime() / 1000), Math.floor(to.getTime() / 1000));

    return NextResponse.json({ candles });
  } catch (error) {
    console.error('Error fetching candles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock candles', candles: [] },
      { status: 500 }
    );
  }
}
