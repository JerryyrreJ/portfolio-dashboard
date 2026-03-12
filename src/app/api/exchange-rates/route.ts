import { NextResponse } from 'next/server';
import { getFallbackRates, USD_RATES } from '@/lib/currency';

const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedBase = searchParams.get('base') || 'USD';

  // Always return USD-based rates for consistent conversion logic
  // Client will handle the conversion to the target currency
  if (!EXCHANGE_API_KEY) {
    return NextResponse.json({
      base: 'USD',
      rates: USD_RATES,
      lastUpdated: new Date().toISOString(),
      isFallback: true,
    });
  }

  try {
    // Always fetch USD-based rates from the API
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/USD`,
      { next: { revalidate: 3600 } }
    );

    if (!response.ok) throw new Error('Failed to fetch exchange rates');

    const data = await response.json();
    const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'SGD'];
    const rates: Record<string, number> = {};
    commonCurrencies.forEach(currency => {
      if (data.conversion_rates[currency]) {
        rates[currency] = data.conversion_rates[currency];
      }
    });

    return NextResponse.json({
      base: 'USD',
      rates,
      lastUpdated: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      base: 'USD',
      rates: USD_RATES,
      lastUpdated: new Date().toISOString(),
      isFallback: true,
    });
  }
}
