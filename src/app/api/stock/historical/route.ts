import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const BASE_URL = 'https://finnhub.io/api/v1';

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

  if (!FINNHUB_API_KEY) {
    return NextResponse.json(
      { error: 'Finnhub API key not configured' },
      { status: 500 }
    );
  }

  try {
    // 解析日期
    const targetDate = new Date(date);
    // 设置时间为当天结束，确保获取当天的数据
    targetDate.setHours(23, 59, 59, 999);
    const to = Math.floor(targetDate.getTime() / 1000);

    // 从开始时间（当天开始）
    const fromDate = new Date(date);
    fromDate.setHours(0, 0, 0, 0);
    const from = Math.floor(fromDate.getTime() / 1000);

    const url = `${BASE_URL}/stock/candle?symbol=${symbol.toUpperCase()}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // 缓存 1 天
    });

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data = await response.json();

    // Finnhub 返回格式: { c: [close], h: [high], l: [low], o: [open], t: [timestamp], s: "ok" }
    if (data.s === 'ok' && data.c && data.c.length > 0) {
      return NextResponse.json({
        symbol: symbol.toUpperCase(),
        date: date,
        price: data.c[0], // 收盘价
        open: data.o[0],
        high: data.h[0],
        low: data.l[0],
        timestamp: data.t[0],
      });
    } else {
      return NextResponse.json(
        { error: 'No data available for the specified date', raw: data },
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
