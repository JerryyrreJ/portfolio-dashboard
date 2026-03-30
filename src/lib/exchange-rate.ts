import { USD_RATES } from '@/lib/currency';

export async function getPriceUSD(
  price: number,
  currency: string
): Promise<{ priceUSD: number; exchangeRate: number }> {
  if (currency === 'USD') {
    return { priceUSD: price, exchangeRate: 1 };
  }

  try {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
      throw new Error('No API key');
    }

    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) {
      throw new Error('Exchange rate fetch failed');
    }

    const data = await res.json();
    const rate: number = data.conversion_rates?.[currency] ?? USD_RATES[currency] ?? 1;
    return { priceUSD: price / rate, exchangeRate: rate };
  } catch {
    const rate = USD_RATES[currency] ?? 1;
    return { priceUSD: price / rate, exchangeRate: rate };
  }
}
