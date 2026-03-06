import { NextResponse } from 'next/server';
import { getCandles } from '@/lib/finnhub';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const range = searchParams.get('range') || '1Y';

  if (!ticker) {
    return NextResponse.json({ error: 'Ticker symbol is required' }, { status: 400 });
  }

  try {
    const to = new Date();
    const from = new Date();
    let resolution = 'D';

    switch (range) {
      case '1D':
        // From start of current trading day, hourly candles
        from.setHours(0, 0, 0, 0);
        resolution = '60';
        break;
      case '1W':
        from.setDate(to.getDate() - 7);
        resolution = 'D';
        break;
      case '1M':
        from.setMonth(to.getMonth() - 1);
        resolution = 'D';
        break;
      case '3M':
        from.setMonth(to.getMonth() - 3);
        resolution = 'D';
        break;
      case '1Y':
        from.setFullYear(to.getFullYear() - 1);
        resolution = 'W';
        break;
      case 'All':
        from.setFullYear(to.getFullYear() - 5);
        resolution = 'M';
        break;
      default:
        from.setFullYear(to.getFullYear() - 1);
        resolution = 'W';
    }

    const candles = await getCandles(
      ticker,
      Math.floor(from.getTime() / 1000),
      Math.floor(to.getTime() / 1000),
      resolution
    );

    return NextResponse.json({ candles });
  } catch (error) {
    console.error('Error fetching candles:', error);
    return NextResponse.json({ error: 'Failed to fetch candles', candles: null }, { status: 500 });
  }
}
