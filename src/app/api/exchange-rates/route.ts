import { NextResponse } from 'next/server';
import { USD_RATES } from '@/lib/currency';
import { createServerProfiler } from '@/lib/perf';

const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

export async function GET() {
  const perf = createServerProfiler('api/exchange-rates.GET');
  // Always return USD-based rates for consistent conversion logic
  // Client will handle the conversion to the target currency
  if (!EXCHANGE_API_KEY) {
    perf.flush('fallback=no-api-key');
    return NextResponse.json({
      base: 'USD',
      rates: USD_RATES,
      lastUpdated: new Date().toISOString(),
      isFallback: true,
    });
  }

  try {
    // Always fetch USD-based rates from the API
    const response = await perf.time('exchangeApi.fetch', () => fetch(
      `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`,
      { next: { revalidate: 3600 } }
    ));

    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await perf.time('exchangeApi.json', () => response.json());
    const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'SGD'];
    const rates: Record<string, number> = {};
    commonCurrencies.forEach(currency => {
      if (data.conversion_rates[currency]) {
        rates[currency] = data.conversion_rates[currency];
      }
    });

    perf.flush(`rates=${Object.keys(rates).length}`);
    return NextResponse.json({
      base: 'USD',
      rates,
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    perf.flush('fallback=fetch-error');
    return NextResponse.json({
      base: 'USD',
      rates: USD_RATES,
      lastUpdated: new Date().toISOString(),
      isFallback: true,
    });
  }
}
