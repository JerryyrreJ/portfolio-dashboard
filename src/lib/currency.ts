export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥',
  HKD: 'HK$', AUD: 'A$', CAD: 'CA$', CHF: 'Fr', SGD: 'S$',
};

export const USD_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, CNY: 7.24,
  HKD: 7.82, AUD: 1.53, CAD: 1.36, CHF: 0.90, SGD: 1.34,
};

export function getFallbackRates(base: string): Record<string, number> {
  if (base === 'USD') return USD_RATES;
  const baseRate = USD_RATES[base];
  if (!baseRate) return USD_RATES;
  const rates: Record<string, number> = {};
  for (const [currency, rate] of Object.entries(USD_RATES)) {
    rates[currency] = rate / baseRate;
  }
  return rates;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function convertAmount(usdAmount: number, rates: Record<string, number>, targetCurrency: string): number {
  if (targetCurrency === 'USD') return usdAmount;
  const rate = rates[targetCurrency];
  if (!rate) return usdAmount;
  return usdAmount * rate;
}

export function formatCurrency(usdAmount: number, currency: string, rates: Record<string, number>): string {
  const converted = convertAmount(usdAmount, rates, currency);
  const symbol = getCurrencySymbol(currency);
  const decimals = ['JPY'].includes(currency) ? 0 : 2;
  return `${symbol}${converted.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
