import { NextRequest, NextResponse } from 'next/server';

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY;
const BASE_URL = 'https://api.twelvedata.com';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');
  const date = searchParams.get('date'); // 格式: YYYY-MM-DD

  if (!symbol || !date) {
    return NextResponse.json(
      { error: 'Symbol and date parameters are required' },
      { status: 400 }
    );
  }

  if (!TWELVEDATA_API_KEY) {
    return NextResponse.json(
      { error: 'Twelve Data API key not configured' },
      { status: 500 }
    );
  }

  try {
    // 往前取 7 天窗口，确保即使选中周末/节假日也能拿到最近的交易日收盘价
    const endDate = date;
    const startDate = new Date(date + 'T00:00:00Z');
    startDate.setUTCDate(startDate.getUTCDate() - 7);
    const startDateStr = startDate.toISOString().split('T')[0];

    const url = `${BASE_URL}/time_series?symbol=${symbol.toUpperCase()}&interval=1day&start_date=${startDateStr}&end_date=${endDate}&outputsize=10&apikey=${TWELVEDATA_API_KEY}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // 缓存 1 天
    });

    if (!response.ok) {
      throw new Error(`Twelve Data API error: ${response.status}`);
    }

    const data = await response.json();

    // Twelve Data 返回: { status: "ok", values: [{ datetime, open, high, low, close, volume }, ...] }
    // values 按时间倒序排列，第一条是最接近 endDate 的交易日
    if (data.status === 'ok' && data.values && data.values.length > 0) {
      const latest = data.values[0];
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        date: latest.datetime,
        price: parseFloat(latest.close),
        open: parseFloat(latest.open),
        high: parseFloat(latest.high),
        low: parseFloat(latest.low),
      });
    } else {
      return NextResponse.json(
        { error: data.message || 'No data available for the specified date' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Historical price error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical price' },
      { status: 500 }
    );
  }
}
