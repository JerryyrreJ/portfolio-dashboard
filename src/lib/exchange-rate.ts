import { normalizeSupportedCurrency, USD_RATES } from '@/lib/currency';

export class ExchangeRateUnavailableError extends Error {
  readonly code = 'EXCHANGE_RATE_UNAVAILABLE';

  constructor(currency: string) {
    super(`No exchange rate is available for ${currency}.`);
    this.name = 'ExchangeRateUnavailableError';
  }
}

function requireValidRate(currency: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new ExchangeRateUnavailableError(currency);
  }
  return value;
}

export async function getPriceUSD(
  price: number,
  currency: string
): Promise<{ priceUSD: number; exchangeRate: number }> {
  if (!Number.isFinite(price)) {
    throw new TypeError('Price must be a finite number.');
  }

  const normalizedCurrency = normalizeSupportedCurrency(currency);
  if (!normalizedCurrency) {
    throw new ExchangeRateUnavailableError(String(currency));
  }

  if (normalizedCurrency === 'USD') {
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
    const candidate = data.conversion_rates?.[normalizedCurrency] ?? USD_RATES[normalizedCurrency];
    const rate = requireValidRate(normalizedCurrency, candidate);
    const priceUSD = price / rate;
    if (!Number.isFinite(priceUSD)) {
      throw new ExchangeRateUnavailableError(normalizedCurrency);
    }
    return { priceUSD, exchangeRate: rate };
  } catch {
    const rate = requireValidRate(normalizedCurrency, USD_RATES[normalizedCurrency]);
    const priceUSD = price / rate;
    if (!Number.isFinite(priceUSD)) {
      throw new ExchangeRateUnavailableError(normalizedCurrency);
    }
    return { priceUSD, exchangeRate: rate };
  }
}
