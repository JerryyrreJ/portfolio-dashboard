import { NextResponse } from 'next/server';

// 使用 exchangerate-api.com 的免费 API
const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const baseCurrency = searchParams.get('base') || 'USD';

  try {
    // 使用 exchangerate-api.com
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/${baseCurrency}`,
      { next: { revalidate: 3600 } } // 缓存1小时
    );

    if (!response.ok) {
      throw new Error('Failed to fetch exchange rates');
    }

    const data = await response.json();

    // 返回常用货币的汇率
    const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'SGD'];
    const rates: Record<string, number> = {};

    commonCurrencies.forEach(currency => {
      if (data.conversion_rates[currency]) {
        rates[currency] = data.conversion_rates[currency];
      }
    });

    return NextResponse.json({
      base: baseCurrency,
      rates,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);

    // 返回备用数据
    return NextResponse.json({
      base: baseCurrency,
      rates: {
        USD: 1,
        EUR: 0.85,
        GBP: 0.73,
        JPY: 150,
        CNY: 7.2,
        HKD: 7.8,
        AUD: 1.52,
        CAD: 1.36,
        CHF: 0.88,
        SGD: 1.34,
      },
      lastUpdated: new Date().toISOString(),
      isFallback: true,
    });
  }
}
